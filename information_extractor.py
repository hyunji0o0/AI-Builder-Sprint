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

from document_classifier import classify_document


# ============================================================
# 프로젝트 및 API 설정
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent

UPSTAGE_INFORMATION_EXTRACT_URL = (
    "https://api.upstage.ai/v1/information-extraction"
)

UPSTAGE_INFORMATION_EXTRACT_MODEL = (
    "information-extract"
)

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
# 오류 클래스
# ============================================================

class InformationExtractionError(Exception):
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
        "stage": "information_extract",
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
# 파일 처리
# ============================================================

def validate_input_file(
    file_path: Path,
) -> None:
    if not file_path.exists():
        raise InformationExtractionError(
            code="FILE_NOT_FOUND",
            message=(
                f"파일을 찾지 못했습니다: "
                f"{file_path}"
            ),
            details={
                "filePath": str(file_path),
            },
        )

    if not file_path.is_file():
        raise InformationExtractionError(
            code="INVALID_FILE_PATH",
            message=(
                "입력 경로가 파일이 아닙니다."
            ),
            details={
                "filePath": str(file_path),
            },
        )

    extension = file_path.suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise InformationExtractionError(
            code="UNSUPPORTED_FILE_TYPE",
            message=(
                "지원하지 않는 파일 형식입니다: "
                f"{extension or '(확장자 없음)'}"
            ),
            details={
                "filePath": str(file_path),
                "extension": extension,
                "supportedExtensions": sorted(
                    SUPPORTED_EXTENSIONS
                ),
            },
        )

    if file_path.stat().st_size == 0:
        raise InformationExtractionError(
            code="EMPTY_FILE",
            message="입력 파일의 크기가 0바이트입니다.",
            details={
                "filePath": str(file_path),
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

    return (
        guessed_type
        or "application/octet-stream"
    )


def file_to_data_url(
    file_path: Path,
) -> str:
    try:
        with file_path.open(
            "rb"
        ) as input_file:
            encoded_data = base64.b64encode(
                input_file.read()
            ).decode("utf-8")

    except OSError as error:
        raise InformationExtractionError(
            code="FILE_READ_ERROR",
            message="입력 파일을 읽지 못했습니다.",
            details={
                "filePath": str(file_path),
                "reason": str(error),
            },
        ) from error

    mime_type = get_mime_type(
        file_path
    )

    return (
        f"data:{mime_type};"
        f"base64,{encoded_data}"
    )


# ============================================================
# API 키 처리
# ============================================================

def load_api_key() -> str:
    load_dotenv(
        PROJECT_ROOT / ".env",
        override=False,
    )

    api_key = os.getenv(
        "UPSTAGE_API_KEY",
        "",
    ).strip()

    if not api_key:
        raise InformationExtractionError(
            code="API_KEY_NOT_FOUND",
            message=(
                ".env 파일에 UPSTAGE_API_KEY가 "
                "설정되어 있지 않습니다."
            ),
        )

    return api_key


# ============================================================
# JSON 파일 처리
# ============================================================

def load_json_file(
    file_path: Path,
) -> dict[str, Any]:
    if not file_path.exists():
        raise InformationExtractionError(
            code="SCHEMA_NOT_FOUND",
            message=(
                f"스키마 파일을 찾지 못했습니다: "
                f"{file_path}"
            ),
            details={
                "schemaPath": str(file_path),
            },
        )

    if not file_path.is_file():
        raise InformationExtractionError(
            code="SCHEMA_NOT_FOUND",
            message=(
                "스키마 경로가 파일이 아닙니다."
            ),
            details={
                "schemaPath": str(file_path),
            },
        )

    try:
        with file_path.open(
            "r",
            encoding="utf-8",
        ) as schema_file:
            schema_document = json.load(
                schema_file
            )

    except json.JSONDecodeError as error:
        raise InformationExtractionError(
            code="INVALID_SCHEMA",
            message=(
                "스키마 JSON 형식이 "
                "올바르지 않습니다."
            ),
            details={
                "schemaPath": str(file_path),
                "reason": str(error),
            },
        ) from error

    except OSError as error:
        raise InformationExtractionError(
            code="SCHEMA_READ_ERROR",
            message="스키마 파일을 읽지 못했습니다.",
            details={
                "schemaPath": str(file_path),
                "reason": str(error),
            },
        ) from error

    if not isinstance(
        schema_document,
        dict,
    ):
        raise InformationExtractionError(
            code="INVALID_SCHEMA",
            message=(
                "스키마 최상위 값은 "
                "JSON 객체여야 합니다."
            ),
            details={
                "schemaPath": str(file_path),
            },
        )

    return schema_document


def save_json_file(
    output_path: Path,
    data: dict[str, Any],
) -> None:
    output_path = (
        output_path
        .expanduser()
        .resolve()
    )

    output_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with output_path.open(
        "w",
        encoding="utf-8",
    ) as output_file:
        json.dump(
            data,
            output_file,
            ensure_ascii=False,
            indent=2,
        )


# ============================================================
# JSON Schema 처리
# ============================================================

def sanitize_schema_name(
    value: str,
) -> str:
    value = re.sub(
        r"[^a-zA-Z0-9_-]+",
        "_",
        value,
    )

    value = value.strip("_")

    if not value:
        value = "document_extraction"

    return value[:64]


def get_root_json_schema(
    schema_document: dict[str, Any],
) -> dict[str, Any]:
    """
    아래 두 스키마 형식을 모두 지원한다.

    1. Upstage response_format 형식

       {
         "type": "json_schema",
         "json_schema": {
           "name": "...",
           "schema": {
             ...
           }
         }
       }

    2. 일반 JSON Schema 형식

       {
         "type": "object",
         "properties": {
           ...
         }
       }
    """

    if (
        schema_document.get("type")
        == "json_schema"
        and isinstance(
            schema_document.get(
                "json_schema"
            ),
            dict,
        )
    ):
        json_schema_wrapper = (
            schema_document[
                "json_schema"
            ]
        )

        root_schema = (
            json_schema_wrapper.get(
                "schema"
            )
        )

        if isinstance(
            root_schema,
            dict,
        ):
            return root_schema

    if isinstance(
        schema_document.get(
            "json_schema"
        ),
        dict,
    ):
        json_schema_wrapper = (
            schema_document[
                "json_schema"
            ]
        )

        root_schema = (
            json_schema_wrapper.get(
                "schema"
            )
        )

        if isinstance(
            root_schema,
            dict,
        ):
            return root_schema

    return schema_document


def validate_root_schema(
    root_schema: dict[str, Any],
    schema_path: Path,
) -> None:
    schema_type = root_schema.get(
        "type"
    )

    properties = root_schema.get(
        "properties"
    )

    if (
        schema_type != "object"
        and not isinstance(
            properties,
            dict,
        )
    ):
        raise InformationExtractionError(
            code="INVALID_SCHEMA",
            message=(
                "추출 스키마의 최상위 형식은 "
                "object여야 합니다."
            ),
            details={
                "schemaPath": str(schema_path),
                "rootType": schema_type,
            },
        )

    if not isinstance(
        properties,
        dict,
    ):
        raise InformationExtractionError(
            code="INVALID_SCHEMA",
            message=(
                "추출 스키마에 properties 객체가 "
                "없습니다."
            ),
            details={
                "schemaPath": str(schema_path),
            },
        )


def get_schema_name(
    schema_document: dict[str, Any],
    fallback_name: str,
) -> str:
    json_schema_wrapper = (
        schema_document.get(
            "json_schema"
        )
    )

    if isinstance(
        json_schema_wrapper,
        dict,
    ):
        existing_name = (
            json_schema_wrapper.get(
                "name"
            )
        )

        if isinstance(
            existing_name,
            str,
        ) and existing_name.strip():
            return sanitize_schema_name(
                existing_name
            )

    return sanitize_schema_name(
        fallback_name
    )


def build_response_format(
    schema_document: dict[str, Any],
    schema_name: str,
) -> dict[str, Any]:
    """
    schema.json이 이미 response_format 구조이면
    그대로 사용하고, 일반 JSON Schema이면
    Upstage response_format 구조로 감싼다.
    """

    if (
        schema_document.get("type")
        == "json_schema"
        and isinstance(
            schema_document.get(
                "json_schema"
            ),
            dict,
        )
    ):
        response_format = dict(
            schema_document
        )

        json_schema_wrapper = dict(
            response_format[
                "json_schema"
            ]
        )

        if not json_schema_wrapper.get(
            "name"
        ):
            json_schema_wrapper[
                "name"
            ] = schema_name

        response_format[
            "json_schema"
        ] = json_schema_wrapper

        return response_format

    if isinstance(
        schema_document.get(
            "json_schema"
        ),
        dict,
    ):
        json_schema_wrapper = dict(
            schema_document[
                "json_schema"
            ]
        )

        if not json_schema_wrapper.get(
            "name"
        ):
            json_schema_wrapper[
                "name"
            ] = schema_name

        return {
            "type": "json_schema",
            "json_schema":
                json_schema_wrapper,
        }

    return {
        "type": "json_schema",
        "json_schema": {
            "name": schema_name,
            "schema": schema_document,
        },
    }


# ============================================================
# Upstage 응답 처리
# ============================================================

def remove_markdown_code_block(
    value: str,
) -> str:
    text = value.strip()

    if not text.startswith(
        "```"
    ):
        return text

    lines = text.splitlines()

    if lines:
        lines = lines[1:]

    if (
        lines
        and lines[-1].strip() == "```"
    ):
        lines = lines[:-1]

    return "\n".join(
        lines
    ).strip()


def parse_json_text(
    value: str,
) -> dict[str, Any]:
    cleaned = remove_markdown_code_block(
        value
    )

    try:
        result = json.loads(
            cleaned
        )

    except json.JSONDecodeError:
        start_index = cleaned.find(
            "{"
        )

        end_index = cleaned.rfind(
            "}"
        )

        if (
            start_index == -1
            or end_index == -1
            or end_index <= start_index
        ):
            raise InformationExtractionError(
                code=(
                    "INVALID_EXTRACTION_RESULT"
                ),
                message=(
                    "Upstage 응답에서 JSON 객체를 "
                    "찾지 못했습니다."
                ),
                details={
                    "responsePreview":
                        cleaned[:1000],
                },
            )

        json_text = cleaned[
            start_index:
            end_index + 1
        ]

        try:
            result = json.loads(
                json_text
            )

        except json.JSONDecodeError as error:
            raise InformationExtractionError(
                code=(
                    "INVALID_EXTRACTION_RESULT"
                ),
                message=(
                    "Information Extract 결과가 "
                    "올바른 JSON 형식이 아닙니다."
                ),
                details={
                    "reason": str(error),
                    "responsePreview":
                        cleaned[:1000],
                },
            ) from error

    if not isinstance(
        result,
        dict,
    ):
        raise InformationExtractionError(
            code="INVALID_EXTRACTION_RESULT",
            message=(
                "추출 결과 최상위 값은 "
                "JSON 객체여야 합니다."
            ),
        )

    return result


def extract_result_from_response(
    response_body: dict[str, Any],
) -> dict[str, Any]:
    """
    Upstage 응답에서 실제 추출 JSON을 꺼낸다.
    """

    # 일부 응답이 data 객체를 직접 제공할 경우
    direct_data = response_body.get(
        "data"
    )

    if isinstance(
        direct_data,
        dict,
    ):
        return direct_data

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
        raise InformationExtractionError(
            code="INVALID_EXTRACTION_RESULT",
            message=(
                "Upstage 응답에 "
                "choices[0].message.content가 "
                "없습니다."
            ),
            details={
                "responseKeys": list(
                    response_body.keys()
                ),
            },
        ) from error

    if isinstance(
        content,
        dict,
    ):
        return content

    if isinstance(
        content,
        str,
    ):
        return parse_json_text(
            content
        )

    if isinstance(
        content,
        list,
    ):
        text_parts: list[str] = []

        for item in content:
            if isinstance(
                item,
                str,
            ):
                text_parts.append(
                    item
                )
                continue

            if not isinstance(
                item,
                dict,
            ):
                continue

            item_text = item.get(
                "text"
            )

            if isinstance(
                item_text,
                str,
            ):
                text_parts.append(
                    item_text
                )
                continue

            item_content = item.get(
                "content"
            )

            if isinstance(
                item_content,
                str,
            ):
                text_parts.append(
                    item_content
                )

        if text_parts:
            return parse_json_text(
                "\n".join(
                    text_parts
                )
            )

    raise InformationExtractionError(
        code="INVALID_EXTRACTION_RESULT",
        message=(
            "Upstage 응답 content를 "
            "JSON 객체로 변환하지 못했습니다."
        ),
    )


# ============================================================
# Information Extract API 호출
# ============================================================

def request_information_extract(
    api_key: str,
    file_path: Path,
    schema_document: dict[str, Any],
    schema_name: str,
    max_retries: int = 2,
) -> tuple[
    dict[str, Any],
    dict[str, Any],
]:
    """
    중요:
    Information Extract의 content에는
    image_url 항목 하나만 넣는다.

    text와 image_url을 함께 넣으면
    'content should contain a single item'
    오류가 발생할 수 있다.
    """

    data_url = file_to_data_url(
        file_path
    )

    response_format = (
        build_response_format(
            schema_document=(
                schema_document
            ),
            schema_name=schema_name,
        )
    )

    payload = {
        "model":
            UPSTAGE_INFORMATION_EXTRACT_MODEL,
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
        "response_format":
            response_format,
    }

    headers = {
        "Authorization":
            f"Bearer {api_key}",
        "Content-Type":
            "application/json",
    }

    for attempt in range(
        max_retries + 1
    ):
        try:
            response = requests.post(
                UPSTAGE_INFORMATION_EXTRACT_URL,
                headers=headers,
                json=payload,
                timeout=(15, 180),
            )

        except requests.Timeout as error:
            if attempt < max_retries:
                time.sleep(
                    2 ** attempt
                )
                continue

            raise InformationExtractionError(
                code="UPSTAGE_EXTRACT_TIMEOUT",
                message=(
                    "Information Extract API "
                    "요청 시간이 초과되었습니다."
                ),
                details={
                    "attempts":
                        max_retries + 1,
                },
            ) from error

        except requests.RequestException as error:
            if attempt < max_retries:
                time.sleep(
                    2 ** attempt
                )
                continue

            raise InformationExtractionError(
                code=(
                    "UPSTAGE_EXTRACT_NETWORK_ERROR"
                ),
                message=(
                    "Information Extract API에 "
                    "연결하지 못했습니다."
                ),
                details={
                    "reason": str(error),
                    "attempts":
                        max_retries + 1,
                },
            ) from error

        if (
            response.status_code
            in RETRYABLE_STATUS_CODES
            and attempt < max_retries
        ):
            time.sleep(
                2 ** attempt
            )
            continue

        if not response.ok:
            raise InformationExtractionError(
                code="UPSTAGE_EXTRACT_API_ERROR",
                message=(
                    "Information Extract API가 "
                    "오류 응답을 반환했습니다."
                ),
                details={
                    "statusCode":
                        response.status_code,
                    "responseBody":
                        response.text[:2000],
                    "schemaName":
                        schema_name,
                },
            )

        try:
            response_body = response.json()

        except ValueError as error:
            raise InformationExtractionError(
                code="INVALID_API_RESPONSE",
                message=(
                    "Information Extract API "
                    "응답이 JSON 형식이 아닙니다."
                ),
                details={
                    "responseBody":
                        response.text[:2000],
                },
            ) from error

        if not isinstance(
            response_body,
            dict,
        ):
            raise InformationExtractionError(
                code="INVALID_API_RESPONSE",
                message=(
                    "Information Extract API "
                    "최상위 응답이 객체가 아닙니다."
                ),
            )

        extracted_data = (
            extract_result_from_response(
                response_body
            )
        )

        return (
            extracted_data,
            response_body,
        )

    raise InformationExtractionError(
        code="UPSTAGE_EXTRACT_API_ERROR",
        message=(
            "Information Extract 요청에 "
            "실패했습니다."
        ),
    )


# ============================================================
# 분류 결과 검증
# ============================================================

def validate_classification_result(
    classification_result: dict[str, Any],
    allow_confirmation: bool,
) -> tuple[
    str,
    Path,
]:
    if not isinstance(
        classification_result,
        dict,
    ):
        raise InformationExtractionError(
            code="CLASSIFICATION_FAILED",
            message=(
                "문서 분류 결과가 "
                "JSON 객체가 아닙니다."
            ),
        )

    if not classification_result.get(
        "success"
    ):
        classification_error = (
            classification_result.get(
                "error",
                {},
            )
        )

        raise InformationExtractionError(
            code="CLASSIFICATION_FAILED",
            message=(
                "문서 자동 분류에 실패했습니다."
            ),
            details={
                "classificationError":
                    classification_error,
            },
        )

    document_type = str(
        classification_result.get(
            "documentType",
            "",
        )
    ).strip()

    if (
        not document_type
        or document_type == "unknown"
    ):
        raise InformationExtractionError(
            code="UNSUPPORTED_DOCUMENT_TYPE",
            message=(
                "지원하는 문서 종류로 "
                "분류하지 못했습니다."
            ),
            details={
                "documentType":
                    document_type
                    or "unknown",
                "classification":
                    classification_result.get(
                        "classification",
                        {},
                    ),
            },
        )

    classification_details = (
        classification_result.get(
            "classification",
            {},
        )
    )

    if not isinstance(
        classification_details,
        dict,
    ):
        classification_details = {}

    needs_confirmation = bool(
        classification_details.get(
            "needsConfirmation",
            False,
        )
    )

    if (
        needs_confirmation
        and not allow_confirmation
    ):
        raise InformationExtractionError(
            code=(
                "LOW_CONFIDENCE_CLASSIFICATION"
            ),
            message=(
                "문서 분류 결과에 사용자 확인이 "
                "필요하여 정보 추출을 중단했습니다."
            ),
            details={
                "documentType":
                    document_type,
                "confidence":
                    classification_details.get(
                        "confidence",
                        0,
                    ),
                "evidence":
                    classification_details.get(
                        "evidence",
                        [],
                    ),
            },
        )

    schema_path_value = str(
        classification_result.get(
            "schemaPath",
            "",
        )
    ).strip()

    if not schema_path_value:
        raise InformationExtractionError(
            code="SCHEMA_NOT_FOUND",
            message=(
                "분류 결과에 schemaPath가 "
                "포함되어 있지 않습니다."
            ),
            details={
                "documentType":
                    document_type,
                "organizationKey":
                    classification_result.get(
                        "organizationKey",
                        "",
                    ),
            },
        )

    schema_path = (
        Path(schema_path_value)
        .expanduser()
    )

    if not schema_path.is_absolute():
        schema_path = (
            PROJECT_ROOT
            / schema_path
        )

    schema_path = schema_path.resolve()

    if not schema_path.exists():
        raise InformationExtractionError(
            code="SCHEMA_NOT_FOUND",
            message=(
                f"선택된 스키마 파일이 없습니다: "
                f"{schema_path}"
            ),
            details={
                "documentType":
                    document_type,
                "schemaPath":
                    str(schema_path),
            },
        )

    return (
        document_type,
        schema_path,
    )


# ============================================================
# 범용 정보 추출 함수
# ============================================================

def extract_document_information(
    file_path: str | Path,
    classification_result: (
        dict[str, Any] | None
    ) = None,
    allow_confirmation: bool = False,
    include_raw_response: bool = False,
) -> dict[str, Any]:
    """
    문서를 자동 분류한 뒤 선택된 스키마를 이용해
    Information Extract를 호출한다.

    classification_result를 넘기지 않으면
    document_classifier.py를 내부에서 실행한다.

    최종 통합 파이프라인에서는 이미 생성된
    classification_result를 전달해 중복 호출을 막는다.
    """

    try:
        input_path = (
            Path(file_path)
            .expanduser()
            .resolve()
        )

        validate_input_file(
            input_path
        )

        if classification_result is None:
            classification_result = (
                classify_document(
                    file_path=input_path
                )
            )

        (
            document_type,
            schema_path,
        ) = validate_classification_result(
            classification_result=(
                classification_result
            ),
            allow_confirmation=(
                allow_confirmation
            ),
        )

        schema_document = load_json_file(
            schema_path
        )

        root_schema = get_root_json_schema(
            schema_document
        )

        validate_root_schema(
            root_schema=root_schema,
            schema_path=schema_path,
        )

        organization_key = str(
            classification_result.get(
                "organizationKey",
                "",
            )
        ).strip()

        schema_fallback_name = (
            f"{document_type}_"
            f"{organization_key or 'detail'}"
        )

        schema_name = get_schema_name(
            schema_document=(
                schema_document
            ),
            fallback_name=(
                schema_fallback_name
            ),
        )

        api_key = load_api_key()

        (
            extracted_data,
            raw_response,
        ) = request_information_extract(
            api_key=api_key,
            file_path=input_path,
            schema_document=schema_document,
            schema_name=schema_name,
        )

        usage = raw_response.get(
            "usage",
            {},
        )

        if not isinstance(
            usage,
            dict,
        ):
            usage = {}

        result: dict[str, Any] = {
            "success": True,
            "stage": "information_extract",
            "fileName": input_path.name,
            "filePath": str(input_path),
            "documentType":
                document_type,
            "resultCategory":
                classification_result.get(
                    "resultCategory",
                    "",
                ),
            "sourceOrganization":
                classification_result.get(
                    "sourceOrganization",
                    "",
                ),
            "organizationKey":
                organization_key,
            "schema": {
                "name": schema_name,
                "path": str(schema_path),
                "exists": True,
            },
            "classification": (
                classification_result.get(
                    "classification",
                    {},
                )
            ),
            "extraction": {
                "api":
                    "information-extraction",
                "model":
                    UPSTAGE_INFORMATION_EXTRACT_MODEL,
                "usage": usage,
            },
            "data": extracted_data,
            "warnings": list(
                classification_result.get(
                    "warnings",
                    [],
                )
                or []
            ),
        }

        if include_raw_response:
            result["rawResponse"] = (
                raw_response
            )

        return result

    except InformationExtractionError as error:
        return make_error_response(
            code=error.code,
            message=error.message,
            details=error.details,
        )

    except Exception as error:
        return make_error_response(
            code=(
                "UNEXPECTED_EXTRACTION_ERROR"
            ),
            message=(
                "정보 추출 중 예상하지 못한 "
                "오류가 발생했습니다."
            ),
            details={
                "reason": str(error),
                "exceptionType":
                    type(error).__name__,
            },
        )


# ============================================================
# CLI
# ============================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "문서를 자동 분류하고, 선택된 "
            "schema.json을 이용해 필요한 "
            "정보를 추출합니다."
        )
    )

    parser.add_argument(
        "file",
        type=Path,
        help=(
            "정보를 추출할 이미지 또는 PDF"
        ),
    )

    parser.add_argument(
        "--classification-json",
        type=Path,
        help=(
            "기존 document_classifier.py 결과 "
            "JSON 파일을 재사용"
        ),
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="추출 결과 JSON 저장 경로",
    )

    parser.add_argument(
        "--allow-confirmation",
        action="store_true",
        help=(
            "needsConfirmation이 true여도 "
            "정보 추출을 계속 진행"
        ),
    )

    parser.add_argument(
        "--include-raw",
        action="store_true",
        help=(
            "원본 Upstage API 응답을 "
            "결과에 포함"
        ),
    )

    args = parser.parse_args()

    classification_result = None

    if args.classification_json:
        try:
            classification_result = (
                load_json_file(
                    args.classification_json
                    .expanduser()
                    .resolve()
                )
            )

        except InformationExtractionError as error:
            result = make_error_response(
                code=error.code,
                message=error.message,
                details=error.details,
            )

            print(
                json.dumps(
                    result,
                    ensure_ascii=False,
                    indent=2,
                )
            )

            return 1

    result = extract_document_information(
        file_path=args.file,
        classification_result=(
            classification_result
        ),
        allow_confirmation=(
            args.allow_confirmation
        ),
        include_raw_response=(
            args.include_raw
        ),
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
            output_path=args.output,
            data=result,
        )

        print(
            f"\n추출 결과 저장 완료: "
            f"{args.output.resolve()}",
            file=sys.stderr,
        )

    return (
        0
        if result.get("success")
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(
        main()
    )