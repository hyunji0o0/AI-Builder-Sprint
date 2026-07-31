from __future__ import annotations

import argparse
import copy
import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


# ============================================================
# 오류 클래스
# ============================================================

class NormalizationError(Exception):
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
        "stage": "normalization",
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
# JSON 파일 처리
# ============================================================

def load_json_file(
    file_path: Path,
) -> dict[str, Any]:
    if not file_path.exists():
        raise NormalizationError(
            code="FILE_NOT_FOUND",
            message=f"JSON 파일을 찾지 못했습니다: {file_path}",
            details={
                "filePath": str(file_path),
            },
        )

    if not file_path.is_file():
        raise NormalizationError(
            code="INVALID_FILE_PATH",
            message="입력 경로가 파일이 아닙니다.",
            details={
                "filePath": str(file_path),
            },
        )

    try:
        with file_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            result = json.load(file)

    except json.JSONDecodeError as error:
        raise NormalizationError(
            code="INVALID_JSON",
            message="JSON 형식이 올바르지 않습니다.",
            details={
                "filePath": str(file_path),
                "reason": str(error),
            },
        ) from error

    except OSError as error:
        raise NormalizationError(
            code="FILE_READ_ERROR",
            message="JSON 파일을 읽지 못했습니다.",
            details={
                "filePath": str(file_path),
                "reason": str(error),
            },
        ) from error

    if not isinstance(result, dict):
        raise NormalizationError(
            code="INVALID_JSON",
            message="JSON 최상위 값은 객체여야 합니다.",
            details={
                "filePath": str(file_path),
            },
        )

    return result


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
    ) as file:
        json.dump(
            data,
            file,
            ensure_ascii=False,
            indent=2,
        )


# ============================================================
# Schema 처리
# ============================================================

def get_root_json_schema(
    schema_document: dict[str, Any],
) -> dict[str, Any]:
    """
    다음 두 형식을 모두 지원한다.

    1. Upstage response_format 형식

    {
      "type": "json_schema",
      "json_schema": {
        "name": "...",
        "schema": {
          "type": "object",
          "properties": {}
        }
      }
    }

    2. 일반 JSON Schema 형식

    {
      "type": "object",
      "properties": {}
    }
    """

    if (
        schema_document.get("type") == "json_schema"
        and isinstance(
            schema_document.get("json_schema"),
            dict,
        )
    ):
        root_schema = (
            schema_document["json_schema"]
            .get("schema")
        )

        if isinstance(root_schema, dict):
            return root_schema

    json_schema_wrapper = schema_document.get(
        "json_schema"
    )

    if isinstance(
        json_schema_wrapper,
        dict,
    ):
        root_schema = json_schema_wrapper.get(
            "schema"
        )

        if isinstance(root_schema, dict):
            return root_schema

    return schema_document


def get_schema_type(
    schema: dict[str, Any],
) -> str:
    schema_type = schema.get("type")

    if isinstance(schema_type, str):
        return schema_type

    # ["string", "null"] 형태 지원
    if isinstance(schema_type, list):
        for item in schema_type:
            if item != "null":
                return str(item)

        return "null"

    # anyOf / oneOf nullable 구조 지원
    for key in (
        "anyOf",
        "oneOf",
    ):
        candidates = schema.get(key)

        if not isinstance(candidates, list):
            continue

        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue

            candidate_type = candidate.get(
                "type"
            )

            if (
                isinstance(candidate_type, str)
                and candidate_type != "null"
            ):
                return candidate_type

    if isinstance(
        schema.get("properties"),
        dict,
    ):
        return "object"

    if isinstance(
        schema.get("items"),
        dict,
    ):
        return "array"

    return ""


def get_default_value(
    schema: dict[str, Any],
) -> Any:
    if "default" in schema:
        return copy.deepcopy(
            schema["default"]
        )

    schema_type = get_schema_type(
        schema
    )

    if schema_type == "object":
        return {}

    if schema_type == "array":
        return []

    if schema_type == "integer":
        return 0

    if schema_type == "number":
        return 0.0

    if schema_type == "boolean":
        return False

    if schema_type == "string":
        return ""

    return None


# ============================================================
# 공통 문자열 정리
# ============================================================

def normalize_whitespace(
    value: Any,
) -> str:
    if value is None:
        return ""

    text = str(value)

    text = text.replace(
        "\u00a0",
        " ",
    )

    text = text.replace(
        "\u200b",
        "",
    )

    text = re.sub(
        r"[ \t\r\f\v]+",
        " ",
        text,
    )

    text = re.sub(
        r"\n\s*\n+",
        "\n",
        text,
    )

    return text.strip()


def is_empty_value(
    value: Any,
) -> bool:
    if value is None:
        return True

    if isinstance(value, str):
        normalized = value.strip().lower()

        return normalized in {
            "",
            "-",
            "--",
            "없음",
            "해당없음",
            "해당 없음",
            "미기재",
            "미상",
            "null",
            "none",
            "n/a",
            "na",
        }

    return False


# ============================================================
# 숫자 정규화
# ============================================================

def extract_numeric_text(
    value: Any,
) -> str:
    if value is None:
        return ""

    if isinstance(value, bool):
        return "1" if value else "0"

    if isinstance(
        value,
        (
            int,
            float,
        ),
    ):
        return str(value)

    text = normalize_whitespace(
        value
    )

    # 쉼표, 통화 단위, 건수 단위 등을 제거한다.
    text = text.replace(
        ",",
        "",
    )

    text = re.sub(
        r"(원|건|개|명|회|계좌|건수|원정)$",
        "",
        text,
    )

    text = text.strip()

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        text,
    )

    return (
        match.group(0)
        if match
        else ""
    )


def normalize_integer(
    value: Any,
    default: int = 0,
) -> int:
    if isinstance(value, bool):
        return int(value)

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        if value.is_integer():
            return int(value)

        return int(value)

    numeric_text = extract_numeric_text(
        value
    )

    if not numeric_text:
        return default

    try:
        return int(
            float(numeric_text)
        )

    except ValueError:
        return default


def normalize_number(
    value: Any,
    default: float = 0.0,
) -> float:
    if isinstance(value, bool):
        return float(value)

    if isinstance(
        value,
        (
            int,
            float,
        ),
    ):
        return float(value)

    numeric_text = extract_numeric_text(
        value
    )

    if not numeric_text:
        return default

    try:
        return float(
            numeric_text
        )

    except ValueError:
        return default


# ============================================================
# Boolean 정규화
# ============================================================

TRUE_VALUES = {
    "true",
    "1",
    "yes",
    "y",
    "있음",
    "있다",
    "유",
    "예",
    "해당",
    "확인",
    "확인됨",
    "조회됨",
    "보유",
    "보유함",
    "존재",
    "o",
    "○",
}

FALSE_VALUES = {
    "false",
    "0",
    "no",
    "n",
    "없음",
    "없다",
    "무",
    "아니오",
    "미해당",
    "미확인",
    "미조회",
    "미보유",
    "존재하지않음",
    "x",
    "×",
}


def normalize_boolean(
    value: Any,
    default: bool = False,
) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(
        value,
        (
            int,
            float,
        ),
    ):
        return value != 0

    text = normalize_whitespace(
        value
    ).lower()

    compact = re.sub(
        r"\s+",
        "",
        text,
    )

    if compact in TRUE_VALUES:
        return True

    if compact in FALSE_VALUES:
        return False

    if any(
        token in compact
        for token in (
            "있음",
            "보유",
            "확인됨",
            "조회됨",
        )
    ):
        return True

    if any(
        token in compact
        for token in (
            "없음",
            "미보유",
            "미조회",
            "미확인",
        )
    ):
        return False

    return default


# ============================================================
# 날짜·시간 정규화
# ============================================================

def normalize_date(
    value: Any,
) -> str:
    if is_empty_value(value):
        return ""

    text = normalize_whitespace(
        value
    )

    text = re.sub(
        r"\([^)]*\)",
        "",
        text,
    ).strip()

    patterns = [
        # 2026년 7월 20일
        r"(?P<year>\d{4})\s*년\s*"
        r"(?P<month>\d{1,2})\s*월\s*"
        r"(?P<day>\d{1,2})\s*일",

        # 2026.07.20 / 2026-07-20 / 2026/07/20
        r"(?P<year>\d{4})\s*[-./]\s*"
        r"(?P<month>\d{1,2})\s*[-./]\s*"
        r"(?P<day>\d{1,2})",

        # 20260720
        r"(?P<year>\d{4})"
        r"(?P<month>\d{2})"
        r"(?P<day>\d{2})",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
        )

        if not match:
            continue

        try:
            parsed = datetime(
                year=int(
                    match.group("year")
                ),
                month=int(
                    match.group("month")
                ),
                day=int(
                    match.group("day")
                ),
            )

        except ValueError:
            return text

        return parsed.strftime(
            "%Y-%m-%d"
        )

    return text


def normalize_time(
    value: Any,
) -> str:
    if is_empty_value(value):
        return ""

    text = normalize_whitespace(
        value
    )

    is_pm = bool(
        re.search(
            r"(오후|PM|P\.M\.)",
            text,
            flags=re.IGNORECASE,
        )
    )

    is_am = bool(
        re.search(
            r"(오전|AM|A\.M\.)",
            text,
            flags=re.IGNORECASE,
        )
    )

    text = re.sub(
        r"(오전|오후|AM|PM|A\.M\.|P\.M\.)",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()

    patterns = [
        # 14시 20분 30초
        r"(?P<hour>\d{1,2})\s*시"
        r"(?:\s*(?P<minute>\d{1,2})\s*분)?"
        r"(?:\s*(?P<second>\d{1,2})\s*초)?",

        # 14:20:30 또는 14:20
        r"(?P<hour>\d{1,2})\s*:"
        r"\s*(?P<minute>\d{1,2})"
        r"(?:\s*:\s*(?P<second>\d{1,2}))?",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
        )

        if not match:
            continue

        hour = int(
            match.group("hour")
        )

        minute = int(
            match.group("minute") or 0
        )

        second = int(
            match.group("second") or 0
        )

        if is_pm and hour < 12:
            hour += 12

        if is_am and hour == 12:
            hour = 0

        if not (
            0 <= hour <= 23
            and 0 <= minute <= 59
            and 0 <= second <= 59
        ):
            return normalize_whitespace(
                value
            )

        if second:
            return (
                f"{hour:02d}:"
                f"{minute:02d}:"
                f"{second:02d}"
            )

        return (
            f"{hour:02d}:"
            f"{minute:02d}"
        )

    return normalize_whitespace(
        value
    )


def normalize_datetime(
    value: Any,
) -> str:
    if is_empty_value(value):
        return ""

    text = normalize_whitespace(
        value
    )

    normalized_date = normalize_date(
        text
    )

    normalized_time = normalize_time(
        text
    )

    date_match = re.fullmatch(
        r"\d{4}-\d{2}-\d{2}",
        normalized_date,
    )

    time_match = re.fullmatch(
        r"\d{2}:\d{2}(?::\d{2})?",
        normalized_time,
    )

    if date_match and time_match:
        return (
            f"{normalized_date}"
            f"T{normalized_time}"
        )

    if date_match:
        return normalized_date

    return text


# ============================================================
# 전화번호·주민등록번호 정규화
# ============================================================

def normalize_phone_number(
    value: Any,
) -> str:
    if is_empty_value(value):
        return ""

    original = normalize_whitespace(
        value
    )

    extension = ""

    extension_match = re.search(
        r"(?:내선|ext\.?|extension)\s*"
        r"(\d+)",
        original,
        flags=re.IGNORECASE,
    )

    if extension_match:
        extension = extension_match.group(1)

    digits = re.sub(
        r"\D",
        "",
        original,
    )

    # 국가번호 +82 처리
    if digits.startswith("82"):
        digits = digits[2:]

        if not digits.startswith("0"):
            digits = "0" + digits

    formatted = digits

    # 대표번호: 1588-1234 등
    if (
        len(digits) == 8
        and digits[:2] in {
            "15",
            "16",
            "18",
        }
    ):
        formatted = (
            f"{digits[:4]}-"
            f"{digits[4:]}"
        )

    # 서울 지역번호
    elif digits.startswith("02"):
        if len(digits) == 9:
            formatted = (
                f"02-{digits[2:5]}-"
                f"{digits[5:]}"
            )

        elif len(digits) == 10:
            formatted = (
                f"02-{digits[2:6]}-"
                f"{digits[6:]}"
            )

    # 휴대전화 및 일반 지역번호
    elif len(digits) == 10:
        formatted = (
            f"{digits[:3]}-"
            f"{digits[3:6]}-"
            f"{digits[6:]}"
        )

    elif len(digits) == 11:
        formatted = (
            f"{digits[:3]}-"
            f"{digits[3:7]}-"
            f"{digits[7:]}"
        )

    if extension:
        formatted = (
            f"{formatted} 내선 {extension}"
        )

    return formatted or original


def normalize_resident_number(
    value: Any,
) -> str:
    if is_empty_value(value):
        return ""

    text = normalize_whitespace(
        value
    )

    # 마스킹 문자를 유지할 수 있도록 숫자, *, X만 남긴다.
    cleaned = re.sub(
        r"[^0-9*xX]",
        "",
        text,
    )

    if len(cleaned) == 13:
        return (
            f"{cleaned[:6]}-"
            f"{cleaned[6:]}"
        )

    return text


# ============================================================
# 필드 이름 기반 문자열 정규화
# ============================================================

DATE_FIELD_PATTERNS = (
    "date",
    "birthdate",
    "deathdate",
    "reportdate",
    "inquirydate",
    "requestdate",
    "issuedate",
    "notificationdate",
    "transactiondate",
    "maturitydate",
    "startdate",
    "enddate",
    "통지일",
    "조회일",
    "신청일",
    "접수일",
    "발급일",
    "생년월일",
    "사망일",
)

TIME_FIELD_PATTERNS = (
    "time",
    "deathtime",
    "사망시간",
    "사망시각",
)

DATETIME_FIELD_PATTERNS = (
    "datetime",
    "deathdatetime",
    "사망일시",
)

PHONE_FIELD_PATTERNS = (
    "phone",
    "tel",
    "telephone",
    "contactnumber",
    "contactphone",
    "representativenumber",
    "phonenumber",
    "연락처",
    "전화번호",
    "대표번호",
)

RESIDENT_NUMBER_FIELD_PATTERNS = (
    "residentregistrationnumber",
    "residentnumber",
    "registrationnumber",
    "rrn",
    "주민등록번호",
)


def compact_field_name(
    field_name: str,
) -> str:
    return re.sub(
        r"[^a-zA-Z0-9가-힣]",
        "",
        field_name,
    ).lower()


def field_matches(
    field_name: str,
    patterns: tuple[str, ...],
) -> bool:
    compact = compact_field_name(
        field_name
    )

    return any(
        pattern.lower() in compact
        for pattern in patterns
    )


def normalize_enum_value(
    value: Any,
    enum_values: list[Any],
) -> Any:
    if value in enum_values:
        return value

    if isinstance(value, str):
        normalized = normalize_whitespace(
            value
        )

        for enum_value in enum_values:
            if not isinstance(
                enum_value,
                str,
            ):
                continue

            if normalized.lower() == (
                enum_value.strip().lower()
            ):
                return enum_value

    return value


def normalize_string(
    value: Any,
    field_name: str,
    schema: dict[str, Any],
) -> str:
    if is_empty_value(value):
        return ""

    text = normalize_whitespace(
        value
    )

    schema_format = str(
        schema.get(
            "format",
            "",
        )
    ).lower()

    if (
        schema_format == "date-time"
        or field_matches(
            field_name,
            DATETIME_FIELD_PATTERNS,
        )
    ):
        text = normalize_datetime(
            text
        )

    elif (
        schema_format == "date"
        or field_matches(
            field_name,
            DATE_FIELD_PATTERNS,
        )
    ):
        text = normalize_date(
            text
        )

    elif (
        schema_format == "time"
        or field_matches(
            field_name,
            TIME_FIELD_PATTERNS,
        )
    ):
        text = normalize_time(
            text
        )

    elif field_matches(
        field_name,
        PHONE_FIELD_PATTERNS,
    ):
        text = normalize_phone_number(
            text
        )

    elif field_matches(
        field_name,
        RESIDENT_NUMBER_FIELD_PATTERNS,
    ):
        text = normalize_resident_number(
            text
        )

    enum_values = schema.get(
        "enum"
    )

    if isinstance(enum_values, list):
        normalized_enum = normalize_enum_value(
            text,
            enum_values,
        )

        return str(
            normalized_enum
        )

    return text


# ============================================================
# 배열·객체 정규화
# ============================================================

def normalize_array(
    value: Any,
    schema: dict[str, Any],
    field_path: str,
    warnings: list[str],
) -> list[Any]:
    if value is None:
        return []

    if isinstance(value, list):
        source_items = value

    elif is_empty_value(value):
        return []

    else:
        # API가 배열 대신 단일 객체를 반환한 경우
        # 요소 한 개짜리 배열로 보정한다.
        source_items = [value]

        warnings.append(
            f"{field_path}: 배열이 아닌 값을 "
            f"요소 1개의 배열로 변환했습니다."
        )

    item_schema = schema.get(
        "items",
        {},
    )

    if not isinstance(item_schema, dict):
        item_schema = {}

    normalized_items: list[Any] = []

    for index, item in enumerate(
        source_items
    ):
        normalized_item = normalize_by_schema(
            value=item,
            schema=item_schema,
            field_name=str(index),
            field_path=(
                f"{field_path}[{index}]"
            ),
            warnings=warnings,
        )

        normalized_items.append(
            normalized_item
        )

    return normalized_items


def normalize_object(
    value: Any,
    schema: dict[str, Any],
    field_path: str,
    warnings: list[str],
) -> dict[str, Any]:
    if not isinstance(value, dict):
        if value is not None:
            warnings.append(
                f"{field_path}: 객체가 아닌 값을 "
                f"빈 객체로 변환했습니다."
            )

        value = {}

    properties = schema.get(
        "properties",
        {},
    )

    if not isinstance(properties, dict):
        properties = {}

    required_fields = schema.get(
        "required",
        [],
    )

    if not isinstance(
        required_fields,
        list,
    ):
        required_fields = []

    additional_properties = schema.get(
        "additionalProperties",
        True,
    )

    normalized: dict[str, Any] = {}

    for field_name, field_schema in (
        properties.items()
    ):
        if not isinstance(
            field_schema,
            dict,
        ):
            field_schema = {}

        child_path = (
            f"{field_path}.{field_name}"
            if field_path
            else field_name
        )

        if field_name in value:
            normalized[field_name] = (
                normalize_by_schema(
                    value=value[field_name],
                    schema=field_schema,
                    field_name=field_name,
                    field_path=child_path,
                    warnings=warnings,
                )
            )

        elif field_name in required_fields:
            normalized[field_name] = (
                get_default_value(
                    field_schema
                )
            )

            warnings.append(
                f"{child_path}: 필수 필드가 없어 "
                f"기본값을 추가했습니다."
            )

        elif "default" in field_schema:
            normalized[field_name] = (
                copy.deepcopy(
                    field_schema["default"]
                )
            )

    if additional_properties is not False:
        for key, item in value.items():
            if key in normalized:
                continue

            if key in properties:
                continue

            normalized[key] = item

    return normalized


# ============================================================
# 스키마 기반 재귀 정규화
# ============================================================

def normalize_by_schema(
    value: Any,
    schema: dict[str, Any],
    field_name: str = "",
    field_path: str = "",
    warnings: list[str] | None = None,
) -> Any:
    if warnings is None:
        warnings = []

    if not isinstance(schema, dict):
        return value

    schema_type = get_schema_type(
        schema
    )

    if is_empty_value(value):
        return get_default_value(
            schema
        )

    if schema_type == "object":
        return normalize_object(
            value=value,
            schema=schema,
            field_path=field_path,
            warnings=warnings,
        )

    if schema_type == "array":
        return normalize_array(
            value=value,
            schema=schema,
            field_path=field_path,
            warnings=warnings,
        )

    if schema_type == "integer":
        return normalize_integer(
            value
        )

    if schema_type == "number":
        return normalize_number(
            value
        )

    if schema_type == "boolean":
        return normalize_boolean(
            value
        )

    if schema_type == "string":
        return normalize_string(
            value=value,
            field_name=field_name,
            schema=schema,
        )

    return value


# ============================================================
# 문서 특화 후처리
# ============================================================

def synchronize_record_fields(
    data: dict[str, Any],
    schema: dict[str, Any],
    warnings: list[str],
) -> None:
    """
    records 배열과 recordCount / hasRecords를
    서로 일치하도록 보정한다.

    recordCount가 정수인 일반 금융 스키마와
    객체인 생명보험 스키마를 모두 지원한다.
    """

    properties = schema.get(
        "properties",
        {},
    )

    if not isinstance(properties, dict):
        return

    records = data.get("records")

    if not isinstance(records, list):
        return

    actual_count = len(records)

    # --------------------------------------------------------
    # recordCount 보정
    # --------------------------------------------------------

    record_count_schema = properties.get(
        "recordCount"
    )

    if isinstance(record_count_schema, dict):
        record_count_type = get_schema_type(
            record_count_schema
        )

        # 일반 금융 문서:
        # recordCount가 정수인 경우
        if record_count_type == "integer":
            previous_count = data.get(
                "recordCount"
            )

            if previous_count != actual_count:
                data["recordCount"] = actual_count

                warnings.append(
                    "recordCount: records 배열 길이에 "
                    f"맞춰 {actual_count}으로 "
                    "보정했습니다."
                )

        # 생명보험 문서:
        # recordCount가 객체인 경우
        elif record_count_type == "object":
            previous_counts = data.get(
                "recordCount"
            )

            if not isinstance(
                previous_counts,
                dict,
            ):
                previous_counts = {}

            count_properties = (
                record_count_schema.get(
                    "properties",
                    {},
                )
            )

            if not isinstance(
                count_properties,
                dict,
            ):
                count_properties = {}

            unclaimed_count = sum(
                1
                for record in records
                if (
                    isinstance(record, dict)
                    and record.get(
                        "recordCategory"
                    )
                    == "unclaimed_insurance"
                )
            )

            dormant_count = sum(
                1
                for record in records
                if (
                    isinstance(record, dict)
                    and record.get(
                        "recordCategory"
                    )
                    == "dormant_insurance"
                )
            )

            normalized_counts = dict(
                previous_counts
            )

            if "total" in count_properties:
                normalized_counts["total"] = (
                    actual_count
                )

            if (
                "unclaimedInsurance"
                in count_properties
            ):
                normalized_counts[
                    "unclaimedInsurance"
                ] = unclaimed_count

            if (
                "dormantInsurance"
                in count_properties
            ):
                normalized_counts[
                    "dormantInsurance"
                ] = dormant_count

            if normalized_counts != previous_counts:
                warnings.append(
                    "recordCount: records의 "
                    "recordCategory를 기준으로 "
                    "유형별 건수를 보정했습니다."
                )

            data["recordCount"] = (
                normalized_counts
            )

    # --------------------------------------------------------
    # hasRecords 보정
    # --------------------------------------------------------

    if "hasRecords" in properties:
        actual_has_records = (
            actual_count > 0
        )

        previous_has_records = data.get(
            "hasRecords"
        )

        if (
            previous_has_records
            != actual_has_records
        ):
            data["hasRecords"] = (
                actual_has_records
            )

            warnings.append(
                "hasRecords: records 배열 존재 여부에 "
                f"맞춰 {actual_has_records}로 "
                "보정했습니다."
            )


def normalize_document_data(
    extracted_data: dict[str, Any],
    schema_document: dict[str, Any],
) -> tuple[
    dict[str, Any],
    list[str],
]:
    if not isinstance(
        extracted_data,
        dict,
    ):
        raise NormalizationError(
            code="INVALID_EXTRACTION_DATA",
            message=(
                "정규화할 추출 결과의 최상위 값은 "
                "객체여야 합니다."
            ),
        )

    root_schema = get_root_json_schema(
        schema_document
    )

    if not isinstance(
        root_schema,
        dict,
    ):
        raise NormalizationError(
            code="INVALID_SCHEMA",
            message=(
                "스키마 최상위 값은 객체여야 합니다."
            ),
        )

    warnings: list[str] = []

    normalized = normalize_by_schema(
        value=copy.deepcopy(
            extracted_data
        ),
        schema=root_schema,
        field_name="data",
        field_path="data",
        warnings=warnings,
    )

    if not isinstance(
        normalized,
        dict,
    ):
        raise NormalizationError(
            code="NORMALIZATION_ERROR",
            message=(
                "정규화 결과가 객체 형식이 아닙니다."
            ),
        )

    synchronize_record_fields(
        data=normalized,
        schema=root_schema,
        warnings=warnings,
    )

    return (
        normalized,
        warnings,
    )


# ============================================================
# Information Extract 결과 전체 정규화
# ============================================================

def normalize_extraction_result(
    extraction_result: dict[str, Any],
    schema_document: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    information_extractor.py의 전체 반환 결과를 받아
    data만 정규화한다.
    """

    try:
        if not isinstance(
            extraction_result,
            dict,
        ):
            raise NormalizationError(
                code="INVALID_EXTRACTION_RESULT",
                message=(
                    "Information Extract 결과가 "
                    "객체가 아닙니다."
                ),
            )

        if not extraction_result.get(
            "success"
        ):
            return extraction_result

        extracted_data = (
            extraction_result.get(
                "data"
            )
        )

        if not isinstance(
            extracted_data,
            dict,
        ):
            raise NormalizationError(
                code="INVALID_EXTRACTION_DATA",
                message=(
                    "Information Extract 결과의 "
                    "data가 객체가 아닙니다."
                ),
            )

        if schema_document is None:
            schema_info = (
                extraction_result.get(
                    "schema",
                    {},
                )
            )

            if not isinstance(
                schema_info,
                dict,
            ):
                schema_info = {}

            schema_path_value = str(
                schema_info.get(
                    "path",
                    "",
                )
            ).strip()

            if not schema_path_value:
                raise NormalizationError(
                    code="SCHEMA_NOT_FOUND",
                    message=(
                        "추출 결과에 schema.path가 "
                        "포함되어 있지 않습니다."
                    ),
                )

            schema_path = (
                Path(schema_path_value)
                .expanduser()
                .resolve()
            )

            schema_document = load_json_file(
                schema_path
            )

        normalized_data, warnings = (
            normalize_document_data(
                extracted_data=extracted_data,
                schema_document=schema_document,
            )
        )

        result = copy.deepcopy(
            extraction_result
        )

        result["stage"] = "normalization"
        result["data"] = normalized_data

        existing_warnings = result.get(
            "warnings",
            [],
        )

        if not isinstance(
            existing_warnings,
            list,
        ):
            existing_warnings = []

        result["warnings"] = (
            existing_warnings
            + warnings
        )

        result["normalization"] = {
            "success": True,
            "warningCount": len(
                warnings
            ),
        }

        return result

    except NormalizationError as error:
        return make_error_response(
            code=error.code,
            message=error.message,
            details=error.details,
        )

    except Exception as error:
        return make_error_response(
            code="UNEXPECTED_NORMALIZATION_ERROR",
            message=(
                "정규화 중 예상하지 못한 "
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
            "Information Extract 결과를 "
            "schema.json에 맞게 정규화합니다."
        )
    )

    parser.add_argument(
        "extraction_json",
        type=Path,
        help=(
            "information_extractor.py가 생성한 "
            "결과 JSON 파일"
        ),
    )

    parser.add_argument(
        "--schema",
        type=Path,
        help=(
            "직접 지정할 schema.json 경로. "
            "생략하면 extraction_json의 "
            "schema.path를 사용합니다."
        ),
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="정규화 결과 저장 경로",
    )

    args = parser.parse_args()

    try:
        extraction_result = (
            load_json_file(
                args.extraction_json
                .expanduser()
                .resolve()
            )
        )

        schema_document = None

        if args.schema:
            schema_document = (
                load_json_file(
                    args.schema
                    .expanduser()
                    .resolve()
                )
            )

        result = normalize_extraction_result(
            extraction_result=(
                extraction_result
            ),
            schema_document=(
                schema_document
            ),
        )

    except NormalizationError as error:
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

    if args.output:
        save_json_file(
            output_path=args.output,
            data=result,
        )

        print(
            f"\n정규화 결과 저장 완료: "
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