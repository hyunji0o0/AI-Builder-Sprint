from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


# ============================================================
# 프로젝트 및 API 설정
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent
FINANCIAL_DIR = PROJECT_ROOT / "document" / "financial"
COMMON_SCHEMA_PATH = FINANCIAL_DIR / "common" / "schema.json"

UPSTAGE_API_URL = (
    "https://api.upstage.ai/v1/information-extraction"
)
UPSTAGE_MODEL = "information-extract"

DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.70

SUPPORTED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".pdf",
}

RETRYABLE_STATUS_CODES = {
    429,
    500,
    502,
    503,
    504,
}


# ============================================================
# 표준 organizationKey → 실제 폴더명
# ============================================================

ORGANIZATION_FOLDER_MAP = {
    "bank": "bank",
    "life_insurance": "life_insurance",
    "nonlife_insurance": "nonlife_insurance",
    "financial_investment": "financial_investment",
    "credit_finance": "credit_finance",
    "korea_post": "korea_post",
    "savings_bank": "saving_bank",
    "community_credit": "community_credit",
    "forestry_cooperative": "forestry_cooperative",
    "credit_union": "credit_union",
    "securities_depository": "korea_security",
    "consumer_finance": "consumer_finance",
    "deposit_insurance": "deposit",
    "credit_information": "credit_information",
}


DATE_FIELD_HINTS = {
    "date",
    "day",
    "reportedat",
    "createdat",
    "updatedat",
    "transactiondate",
    "notificationdate",
    "inquirydate",
    "startdate",
    "enddate",
    "maturitydate",
    "repaymentdate",
    "통지일",
    "조회일",
    "거래일",
    "상환일",
    "만기일",
    "시작일",
    "종료일",
}

PHONE_FIELD_HINTS = {
    "phone",
    "telephone",
    "contact",
    "phonenumber",
    "contactnumber",
    "전화번호",
    "연락처",
}


# ============================================================
# 표준 파이프라인 오류
# ============================================================

class PipelineError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


def make_error_response(
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
    }

    if details:
        error["details"] = details

    return {
        "success": False,
        "error": error,
    }


# ============================================================
# JSON 및 파일 처리
# ============================================================

def load_json_file(
    file_path: Path,
) -> dict[str, Any]:
    if not file_path.exists():
        raise PipelineError(
            code="SCHEMA_NOT_FOUND",
            message=(
                f"스키마 파일을 찾지 못했습니다: "
                f"{file_path}"
            ),
            details={
                "schemaPath": str(file_path),
            },
        )

    try:
        with file_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            data = json.load(file)
    except json.JSONDecodeError as error:
        raise PipelineError(
            code="INVALID_EXTRACTION_RESULT",
            message=(
                f"스키마 JSON 형식이 올바르지 않습니다: "
                f"{file_path}"
            ),
            details={
                "schemaPath": str(file_path),
                "reason": str(error),
            },
        ) from error

    if not isinstance(data, dict):
        raise PipelineError(
            code="INVALID_EXTRACTION_RESULT",
            message=(
                "스키마의 최상위 값은 객체여야 합니다."
            ),
            details={
                "schemaPath": str(file_path),
            },
        )

    return data


def save_json_file(
    file_path: Path,
    data: dict[str, Any],
) -> None:
    file_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with file_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2,
        )


def validate_input_file(
    file_path: Path,
) -> None:
    if not file_path.exists():
        raise PipelineError(
            code="FILE_NOT_FOUND",
            message=(
                f"업로드 파일을 찾지 못했습니다: "
                f"{file_path}"
            ),
            details={
                "filePath": str(file_path),
            },
        )

    if not file_path.is_file():
        raise PipelineError(
            code="FILE_NOT_FOUND",
            message=(
                "입력 경로가 파일이 아닙니다."
            ),
            details={
                "filePath": str(file_path),
            },
        )

    extension = file_path.suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise PipelineError(
            code="UNSUPPORTED_FILE_TYPE",
            message=(
                f"지원하지 않는 파일 형식입니다: "
                f"{extension or '확장자 없음'}"
            ),
            details={
                "filePath": str(file_path),
                "extension": extension,
                "supportedExtensions": sorted(
                    SUPPORTED_EXTENSIONS
                ),
            },
        )


def get_mime_type(
    file_path: Path,
) -> str:
    fixed_mime_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }

    extension = file_path.suffix.lower()

    if extension in fixed_mime_types:
        return fixed_mime_types[extension]

    guessed_type, _ = mimetypes.guess_type(
        str(file_path)
    )

    return guessed_type or "application/octet-stream"


def file_to_data_url(
    file_path: Path,
) -> str:
    try:
        with file_path.open("rb") as file:
            encoded = base64.b64encode(
                file.read()
            ).decode("utf-8")
    except OSError as error:
        raise PipelineError(
            code="FILE_NOT_FOUND",
            message="업로드 파일을 읽지 못했습니다.",
            details={
                "filePath": str(file_path),
                "reason": str(error),
            },
        ) from error

    mime_type = get_mime_type(file_path)

    return f"data:{mime_type};base64,{encoded}"


# ============================================================
# Upstage 응답 형식 처리
# ============================================================

def get_root_json_schema(
    schema_document: dict[str, Any],
) -> dict[str, Any]:
    if (
        schema_document.get("type") == "json_schema"
        and isinstance(
            schema_document.get("json_schema"),
            dict,
        )
    ):
        json_schema = schema_document["json_schema"]

        if isinstance(
            json_schema.get("schema"),
            dict,
        ):
            return json_schema["schema"]

    if isinstance(
        schema_document.get("json_schema"),
        dict,
    ):
        json_schema = schema_document["json_schema"]

        if isinstance(
            json_schema.get("schema"),
            dict,
        ):
            return json_schema["schema"]

    return schema_document


def build_response_format(
    schema_document: dict[str, Any],
    schema_name: str,
) -> dict[str, Any]:
    if (
        schema_document.get("type") == "json_schema"
        and isinstance(
            schema_document.get("json_schema"),
            dict,
        )
    ):
        return schema_document

    if isinstance(
        schema_document.get("json_schema"),
        dict,
    ):
        return {
            "type": "json_schema",
            "json_schema": schema_document[
                "json_schema"
            ],
        }

    return {
        "type": "json_schema",
        "json_schema": {
            "name": schema_name,
            "schema": schema_document,
        },
    }


def remove_markdown_code_block(
    text: str,
) -> str:
    stripped = text.strip()

    if not stripped.startswith("```"):
        return stripped

    lines = stripped.splitlines()

    if lines:
        lines = lines[1:]

    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]

    return "\n".join(lines).strip()


def parse_json_text(
    text: str,
) -> dict[str, Any]:
    cleaned = remove_markdown_code_block(text)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start_index = cleaned.find("{")
        end_index = cleaned.rfind("}")

        if start_index == -1 or end_index == -1:
            raise PipelineError(
                code="INVALID_EXTRACTION_RESULT",
                message=(
                    "Upstage 응답에서 JSON 객체를 "
                    "찾지 못했습니다."
                ),
                details={
                    "responsePreview": cleaned[:1000],
                },
            )

        json_text = cleaned[
            start_index:end_index + 1
        ]

        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError as error:
            raise PipelineError(
                code="INVALID_EXTRACTION_RESULT",
                message=(
                    "Upstage 추출 결과가 올바른 "
                    "JSON 형식이 아닙니다."
                ),
                details={
                    "reason": str(error),
                    "responsePreview": cleaned[:1000],
                },
            ) from error

    if not isinstance(parsed, dict):
        raise PipelineError(
            code="INVALID_EXTRACTION_RESULT",
            message=(
                "추출 결과의 최상위 값이 객체가 아닙니다."
            ),
        )

    return parsed


def extract_result_from_response(
    response_body: dict[str, Any],
) -> dict[str, Any]:
    try:
        content = (
            response_body["choices"][0]
            ["message"]["content"]
        )
    except (
        KeyError,
        IndexError,
        TypeError,
    ) as error:
        raise PipelineError(
            code="INVALID_EXTRACTION_RESULT",
            message=(
                "Upstage 응답에 "
                "choices[0].message.content가 없습니다."
            ),
            details={
                "response": response_body,
            },
        ) from error

    if isinstance(content, dict):
        return content

    if isinstance(content, str):
        return parse_json_text(content)

    if isinstance(content, list):
        text_parts: list[str] = []

        for item in content:
            if isinstance(item, str):
                text_parts.append(item)
                continue

            if not isinstance(item, dict):
                continue

            item_text = item.get("text")

            if isinstance(item_text, str):
                text_parts.append(item_text)

        if text_parts:
            return parse_json_text(
                "\n".join(text_parts)
            )

    raise PipelineError(
        code="INVALID_EXTRACTION_RESULT",
        message=(
            "Upstage 응답 content를 JSON 객체로 "
            "변환할 수 없습니다."
        ),
    )


def request_information_extract(
    api_key: str,
    file_path: Path,
    schema_document: dict[str, Any],
    schema_name: str,
    max_retries: int = 2,
) -> dict[str, Any]:
    data_url = file_to_data_url(file_path)

    payload = {
        "model": UPSTAGE_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": data_url,
                        },
                    }
                ],
            }
        ],
        "response_format": build_response_format(
            schema_document=schema_document,
            schema_name=schema_name,
        ),
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    for attempt in range(max_retries + 1):
        try:
            response = requests.post(
                UPSTAGE_API_URL,
                headers=headers,
                json=payload,
                timeout=(10, 180),
            )
        except requests.RequestException as error:
            if attempt < max_retries:
                time.sleep(2 ** attempt)
                continue

            raise PipelineError(
                code="UPSTAGE_API_ERROR",
                message=(
                    "Upstage API 요청 중 네트워크 "
                    "오류가 발생했습니다."
                ),
                details={
                    "reason": str(error),
                },
            ) from error

        if (
            response.status_code
            in RETRYABLE_STATUS_CODES
            and attempt < max_retries
        ):
            time.sleep(2 ** attempt)
            continue

        if not response.ok:
            raise PipelineError(
                code="UPSTAGE_API_ERROR",
                message=(
                    "Upstage API가 오류 응답을 반환했습니다."
                ),
                details={
                    "statusCode": response.status_code,
                    "responseBody": response.text[:2000],
                },
            )

        try:
            response_body = response.json()
        except ValueError as error:
            raise PipelineError(
                code="UPSTAGE_API_ERROR",
                message=(
                    "Upstage API 응답이 JSON 형식이 아닙니다."
                ),
                details={
                    "responseBody": response.text[:2000],
                },
            ) from error

        if not isinstance(response_body, dict):
            raise PipelineError(
                code="INVALID_EXTRACTION_RESULT",
                message=(
                    "Upstage API 최상위 응답이 "
                    "객체가 아닙니다."
                ),
            )

        return extract_result_from_response(
            response_body
        )

    raise PipelineError(
        code="UPSTAGE_API_ERROR",
        message="Upstage API 요청에 실패했습니다.",
    )


# ============================================================
# 값 정규화
# ============================================================

def normalize_whitespace(
    value: str,
) -> str:
    return re.sub(
        r"\s+",
        " ",
        value,
    ).strip()


def is_date_field(
    field_name: str,
) -> bool:
    normalized = field_name.lower().replace(
        "_",
        "",
    )

    return any(
        hint in normalized
        for hint in DATE_FIELD_HINTS
    )


def is_phone_field(
    field_name: str,
) -> bool:
    normalized = field_name.lower().replace(
        "_",
        "",
    )

    return any(
        hint in normalized
        for hint in PHONE_FIELD_HINTS
    )


def normalize_date(
    value: Any,
) -> str:
    if value is None:
        return ""

    text = normalize_whitespace(str(value))

    if not text:
        return ""

    separated_match = re.search(
        r"(?P<year>\d{4})\s*"
        r"[./\-년]\s*"
        r"(?P<month>\d{1,2})\s*"
        r"[./\-월]\s*"
        r"(?P<day>\d{1,2})\s*일?",
        text,
    )

    if separated_match:
        year = int(
            separated_match.group("year")
        )
        month = int(
            separated_match.group("month")
        )
        day = int(
            separated_match.group("day")
        )

        if (
            1 <= month <= 12
            and 1 <= day <= 31
        ):
            return (
                f"{year:04d}-"
                f"{month:02d}-"
                f"{day:02d}"
            )

    digit_text = re.sub(
        r"\D",
        "",
        text,
    )

    if len(digit_text) == 8:
        year = int(digit_text[0:4])
        month = int(digit_text[4:6])
        day = int(digit_text[6:8])

        if (
            1 <= month <= 12
            and 1 <= day <= 31
        ):
            return (
                f"{year:04d}-"
                f"{month:02d}-"
                f"{day:02d}"
            )

    return text


def normalize_phone_number(
    value: Any,
) -> str:
    if value is None:
        return ""

    original = normalize_whitespace(str(value))

    if not original:
        return ""

    digits = re.sub(
        r"\D",
        "",
        original,
    )

    if not digits:
        return original

    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:]}"

    if digits.startswith("02"):
        if len(digits) == 9:
            return (
                f"02-{digits[2:5]}-"
                f"{digits[5:]}"
            )

        if len(digits) == 10:
            return (
                f"02-{digits[2:6]}-"
                f"{digits[6:]}"
            )

    if len(digits) == 10:
        return (
            f"{digits[:3]}-"
            f"{digits[3:6]}-"
            f"{digits[6:]}"
        )

    if len(digits) == 11:
        return (
            f"{digits[:3]}-"
            f"{digits[3:7]}-"
            f"{digits[7:]}"
        )

    return original


def parse_number(
    value: Any,
    integer: bool,
) -> int | float:
    if value is None:
        return 0

    if isinstance(value, bool):
        return int(value)

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value) if integer else value

    text = normalize_whitespace(str(value))

    if not text:
        return 0

    is_parenthesized_negative = (
        text.startswith("(")
        and text.endswith(")")
    )

    text = text.replace(",", "")
    text = text.replace("원", "")
    text = text.replace("KRW", "")
    text = text.replace("₩", "")
    text = text.replace(" ", "")

    number_match = re.search(
        r"-?\d+(?:\.\d+)?",
        text,
    )

    if not number_match:
        return 0

    numeric_value = float(
        number_match.group()
    )

    if is_parenthesized_negative:
        numeric_value = -abs(numeric_value)

    if integer:
        return int(round(numeric_value))

    if numeric_value.is_integer():
        return int(numeric_value)

    return numeric_value


def normalize_boolean(
    value: Any,
) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return value != 0

    if value is None:
        return False

    text = normalize_whitespace(
        str(value)
    ).lower()

    true_values = {
        "true",
        "yes",
        "y",
        "1",
        "있음",
        "유",
        "예",
        "가입",
        "가입함",
        "해당",
    }

    false_values = {
        "false",
        "no",
        "n",
        "0",
        "없음",
        "무",
        "아니오",
        "미가입",
        "해당없음",
        "",
    }

    if text in true_values:
        return True

    if text in false_values:
        return False

    return bool(text)


def default_value_for_schema(
    schema: dict[str, Any],
) -> Any:
    schema_type = schema.get("type")

    if isinstance(schema_type, list):
        schema_type = next(
            (
                item
                for item in schema_type
                if item != "null"
            ),
            "",
        )

    if schema_type == "object":
        return {}

    if schema_type == "array":
        return []

    if schema_type == "string":
        return ""

    if schema_type == "number":
        return 0

    if schema_type == "integer":
        return 0

    if schema_type == "boolean":
        return False

    return ""


def normalize_by_schema(
    value: Any,
    schema: dict[str, Any],
    field_name: str = "",
) -> Any:
    schema_type = schema.get("type")

    if isinstance(schema_type, list):
        schema_type = next(
            (
                item
                for item in schema_type
                if item != "null"
            ),
            "",
        )

    if (
        not schema_type
        and isinstance(schema.get("properties"), dict)
    ):
        schema_type = "object"

    if schema_type == "object":
        source = (
            value
            if isinstance(value, dict)
            else {}
        )

        properties = schema.get(
            "properties",
            {},
        )

        if not isinstance(properties, dict):
            properties = {}

        normalized_object: dict[str, Any] = {}

        for property_name, property_schema in (
            properties.items()
        ):
            if not isinstance(property_schema, dict):
                continue

            property_value = source.get(
                property_name,
                default_value_for_schema(
                    property_schema
                ),
            )

            normalized_object[property_name] = (
                normalize_by_schema(
                    value=property_value,
                    schema=property_schema,
                    field_name=property_name,
                )
            )

        if schema.get("additionalProperties") is not False:
            for extra_key, extra_value in source.items():
                if extra_key not in normalized_object:
                    normalized_object[extra_key] = (
                        extra_value
                    )

        return normalized_object

    if schema_type == "array":
        source_list = (
            value
            if isinstance(value, list)
            else []
        )

        item_schema = schema.get(
            "items",
            {},
        )

        if not isinstance(item_schema, dict):
            item_schema = {}

        return [
            normalize_by_schema(
                value=item,
                schema=item_schema,
                field_name=field_name,
            )
            for item in source_list
        ]

    if schema_type == "integer":
        return parse_number(
            value,
            integer=True,
        )

    if schema_type == "number":
        return parse_number(
            value,
            integer=False,
        )

    if schema_type == "boolean":
        return normalize_boolean(value)

    if schema_type == "string":
        if value is None:
            return ""

        text = normalize_whitespace(
            str(value)
        )

        if is_date_field(field_name):
            return normalize_date(text)

        if is_phone_field(field_name):
            return normalize_phone_number(text)

        return text

    return value


# ============================================================
# 간단한 스키마 검증
# ============================================================

def validate_schema_value(
    value: Any,
    schema: dict[str, Any],
    path: str = "$",
) -> list[str]:
    errors: list[str] = []

    schema_type = schema.get("type")

    if isinstance(schema_type, list):
        schema_type = next(
            (
                item
                for item in schema_type
                if item != "null"
            ),
            "",
        )

    if schema_type == "object":
        if not isinstance(value, dict):
            return [
                f"{path}: object 타입이 아닙니다."
            ]

        required_fields = schema.get(
            "required",
            [],
        )

        if isinstance(required_fields, list):
            for required_field in required_fields:
                if required_field not in value:
                    errors.append(
                        f"{path}.{required_field}: "
                        "필수 필드가 없습니다."
                    )

        properties = schema.get(
            "properties",
            {},
        )

        if isinstance(properties, dict):
            for key, property_schema in (
                properties.items()
            ):
                if (
                    key in value
                    and isinstance(
                        property_schema,
                        dict,
                    )
                ):
                    errors.extend(
                        validate_schema_value(
                            value=value[key],
                            schema=property_schema,
                            path=f"{path}.{key}",
                        )
                    )

    elif schema_type == "array":
        if not isinstance(value, list):
            errors.append(
                f"{path}: array 타입이 아닙니다."
            )
        else:
            item_schema = schema.get(
                "items",
                {},
            )

            if isinstance(item_schema, dict):
                for index, item in enumerate(value):
                    errors.extend(
                        validate_schema_value(
                            value=item,
                            schema=item_schema,
                            path=f"{path}[{index}]",
                        )
                    )

    elif schema_type == "string":
        if not isinstance(value, str):
            errors.append(
                f"{path}: string 타입이 아닙니다."
            )

    elif schema_type == "integer":
        if (
            not isinstance(value, int)
            or isinstance(value, bool)
        ):
            errors.append(
                f"{path}: integer 타입이 아닙니다."
            )

    elif schema_type == "number":
        if (
            not isinstance(value, (int, float))
            or isinstance(value, bool)
        ):
            errors.append(
                f"{path}: number 타입이 아닙니다."
            )

    elif schema_type == "boolean":
        if not isinstance(value, bool):
            errors.append(
                f"{path}: boolean 타입이 아닙니다."
            )

    enum_values = schema.get("enum")

    if (
        isinstance(enum_values, list)
        and value not in enum_values
    ):
        errors.append(
            f"{path}: enum 허용값이 아닙니다. "
            f"현재 값={value}"
        )

    return errors


# ============================================================
# 금융 상세 결과 공통 정규화
# ============================================================

def normalize_inquiry_status(
    value: Any,
) -> str:
    text = normalize_whitespace(
        str(value or "")
    ).lower()

    if not text:
        return "completed"

    processing_values = {
        "processing",
        "pending",
        "in_progress",
        "처리중",
        "처리 중",
        "확인중",
        "확인 중",
        "조회중",
        "조회 중",
    }

    completed_values = {
        "completed",
        "complete",
        "done",
        "조회완료",
        "조회 완료",
        "처리완료",
        "처리 완료",
        "완료",
    }

    failed_values = {
        "failed",
        "error",
        "실패",
        "오류",
    }

    if text in processing_values:
        return "processing"

    if text in completed_values:
        return "completed"

    if text in failed_values:
        return "failed"

    return text


def normalize_financial_data(
    data: dict[str, Any],
) -> dict[str, Any]:
    normalized = dict(data)

    records = normalized.get("records", [])

    if not isinstance(records, list):
        records = []

    warnings = normalized.get("warnings", [])

    if isinstance(warnings, str):
        warnings = (
            [normalize_whitespace(warnings)]
            if warnings.strip()
            else []
        )

    if not isinstance(warnings, list):
        warnings = []

    normalized_warnings = [
        normalize_whitespace(str(item))
        for item in warnings
        if normalize_whitespace(str(item))
    ]

    extracted_record_count = parse_number(
        normalized.get("recordCount", 0),
        integer=True,
    )

    actual_record_count = len(records)

    if extracted_record_count != actual_record_count:
        normalized_warnings.append(
            "추출된 recordCount와 records 배열의 "
            "길이가 달라 records 배열 길이를 기준으로 "
            "recordCount를 보정했습니다."
        )

    normalized["inquiryStatus"] = (
        normalize_inquiry_status(
            normalized.get(
                "inquiryStatus",
                "",
            )
        )
    )
    normalized["records"] = records
    normalized["recordCount"] = actual_record_count
    normalized["hasRecords"] = (
        actual_record_count > 0
    )
    normalized["message"] = (
        normalize_whitespace(
            str(
                normalized.get(
                    "message",
                    "",
                )
                or ""
            )
        )
    )
    normalized["warnings"] = list(
        dict.fromkeys(normalized_warnings)
    )

    return normalized


# ============================================================
# 분류 결과 처리
# ============================================================

def normalize_confidence(
    value: Any,
) -> float:
    try:
        confidence = float(value)
    except (
        TypeError,
        ValueError,
    ):
        return 0.0

    return min(
        max(confidence, 0.0),
        1.0,
    )


def normalize_classification(
    classification: dict[str, Any],
) -> dict[str, Any]:
    evidence = classification.get(
        "organizationEvidence",
        [],
    )

    if isinstance(evidence, str):
        evidence = (
            [normalize_whitespace(evidence)]
            if evidence.strip()
            else []
        )

    if not isinstance(evidence, list):
        evidence = []

    normalized_evidence = [
        normalize_whitespace(str(item))
        for item in evidence
        if normalize_whitespace(str(item))
    ]

    return {
        "documentType": normalize_whitespace(
            str(
                classification.get(
                    "documentType",
                    "",
                )
            )
        ),
        "sourceOrganization": normalize_whitespace(
            str(
                classification.get(
                    "sourceOrganization",
                    "",
                )
            )
        ),
        "organizationKey": normalize_whitespace(
            str(
                classification.get(
                    "organizationKey",
                    "",
                )
            )
        ),
        "organizationEvidence": normalized_evidence,
        "confidence": normalize_confidence(
            classification.get(
                "confidence",
                0,
            )
        ),
        "needsConfirmation": normalize_boolean(
            classification.get(
                "needsConfirmation",
                False,
            )
        ),
        "classificationMessage": normalize_whitespace(
            str(
                classification.get(
                    "classificationMessage",
                    "",
                )
            )
        ),
    }


# ============================================================
# 금융 문서 통합 파이프라인
# ============================================================

def analyze_financial_document(
    file_path: str | Path,
    low_confidence_threshold: float = (
        DEFAULT_LOW_CONFIDENCE_THRESHOLD
    ),
) -> dict[str, Any]:
    """
    금융 문서 한 건을 분석한다.

    이 함수는 예외를 외부로 던지지 않고,
    항상 성공 또는 오류 JSON 객체를 반환한다.
    """

    try:
        input_path = Path(file_path).expanduser().resolve()

        validate_input_file(input_path)

        load_dotenv(PROJECT_ROOT / ".env")

        api_key = os.getenv(
            "UPSTAGE_API_KEY",
            "",
        ).strip()

        if not api_key:
            raise PipelineError(
                code="UPSTAGE_API_ERROR",
                message=(
                    ".env에 UPSTAGE_API_KEY가 "
                    "설정되어 있지 않습니다."
                ),
            )

        # ----------------------------------------------------
        # 1단계: 금융기관 공통 분류
        # ----------------------------------------------------

        common_schema_document = load_json_file(
            COMMON_SCHEMA_PATH
        )

        raw_classification = request_information_extract(
            api_key=api_key,
            file_path=input_path,
            schema_document=common_schema_document,
            schema_name="financial_organization_classifier",
        )

        classification = normalize_classification(
            raw_classification
        )

        organization_key = classification[
            "organizationKey"
        ]

        source_organization = classification[
            "sourceOrganization"
        ]

        if (
            not organization_key
            or organization_key
            not in ORGANIZATION_FOLDER_MAP
        ):
            raise PipelineError(
                code="CLASSIFICATION_FAILED",
                message=(
                    "금융 문서 제공 기관을 "
                    "판별하지 못했습니다."
                ),
                details={
                    "classification": classification,
                    "supportedOrganizationKeys": sorted(
                        ORGANIZATION_FOLDER_MAP.keys()
                    ),
                },
            )

        if not source_organization:
            raise PipelineError(
                code="CLASSIFICATION_FAILED",
                message=(
                    "금융 문서 제공 기관명이 "
                    "추출되지 않았습니다."
                ),
                details={
                    "classification": classification,
                },
            )

        confidence = classification["confidence"]
        needs_confirmation = classification[
            "needsConfirmation"
        ]

        if (
            confidence < low_confidence_threshold
            or needs_confirmation
        ):
            raise PipelineError(
                code="LOW_CONFIDENCE",
                message=(
                    "기관 분류 신뢰도가 낮거나 "
                    "사용자 확인이 필요합니다."
                ),
                details={
                    "threshold": (
                        low_confidence_threshold
                    ),
                    "classification": classification,
                },
            )

        # ----------------------------------------------------
        # 2단계: 표준 키를 실제 폴더명으로 변환
        # ----------------------------------------------------

        folder_name = ORGANIZATION_FOLDER_MAP[
            organization_key
        ]

        organization_schema_path = (
            FINANCIAL_DIR
            / folder_name
            / "schema.json"
        )

        organization_schema_document = (
            load_json_file(
                organization_schema_path
            )
        )

        root_schema = get_root_json_schema(
            organization_schema_document
        )

        # ----------------------------------------------------
        # 3단계: 기관별 상세 추출
        # ----------------------------------------------------

        raw_detail_data = request_information_extract(
            api_key=api_key,
            file_path=input_path,
            schema_document=organization_schema_document,
            schema_name=f"{organization_key}_detail",
        )

        # ----------------------------------------------------
        # 4단계: 스키마 기반 정규화 및 검증
        # ----------------------------------------------------

        normalized_detail_data = (
            normalize_by_schema(
                value=raw_detail_data,
                schema=root_schema,
            )
        )

        validation_errors = (
            validate_schema_value(
                value=normalized_detail_data,
                schema=root_schema,
            )
        )

        if validation_errors:
            raise PipelineError(
                code="INVALID_EXTRACTION_RESULT",
                message=(
                    "기관별 상세 추출 결과가 "
                    "스키마와 일치하지 않습니다."
                ),
                details={
                    "organizationKey": organization_key,
                    "schemaPath": str(
                        organization_schema_path
                    ),
                    "validationErrors": (
                        validation_errors
                    ),
                    "rawData": raw_detail_data,
                    "normalizedData": (
                        normalized_detail_data
                    ),
                },
            )

        normalized_detail_data = (
            normalize_financial_data(
                normalized_detail_data
            )
        )

        # ----------------------------------------------------
        # 5단계: 분류 결과와 상세 결과 병합
        # ----------------------------------------------------

        return {
            "success": True,
            "documentType": (
                classification["documentType"]
                or "financial_inquiry_result"
            ),
            "sourceOrganization": (
                source_organization
            ),
            "organizationKey": organization_key,
            "classification": {
                "confidence": confidence,
                "needsConfirmation": (
                    needs_confirmation
                ),
                "evidence": classification[
                    "organizationEvidence"
                ],
                "message": classification[
                    "classificationMessage"
                ],
            },
            "data": normalized_detail_data,
        }

    except PipelineError as error:
        return make_error_response(
            code=error.code,
            message=error.message,
            details=error.details,
        )

    except Exception as error:
        return make_error_response(
            code="INVALID_EXTRACTION_RESULT",
            message=(
                "문서 분석 중 예상하지 못한 "
                "오류가 발생했습니다."
            ),
            details={
                "reason": str(error),
                "exceptionType": (
                    type(error).__name__
                ),
            },
        )


# ============================================================
# CLI 실행
# ============================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "금융 문서 자동 분류 및 상세 정보 추출"
        )
    )

    parser.add_argument(
        "file",
        type=Path,
        help="분석할 이미지 또는 PDF 경로",
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="결과 JSON 저장 경로",
    )

    parser.add_argument(
        "--threshold",
        type=float,
        default=DEFAULT_LOW_CONFIDENCE_THRESHOLD,
        help=(
            "기관 분류 최소 신뢰도. "
            "기본값은 0.70"
        ),
    )

    args = parser.parse_args()

    result = analyze_financial_document(
        file_path=args.file,
        low_confidence_threshold=args.threshold,
    )

    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2,
        )
    )

    if args.output:
        save_json_file(
            file_path=args.output,
            data=result,
        )

        print(
            f"\n결과 저장 완료: {args.output}",
            file=sys.stderr,
        )

    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())