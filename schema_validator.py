from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path
from typing import Any

try:
    from jsonschema import (
        Draft202012Validator,
        FormatChecker,
    )
    from jsonschema.exceptions import SchemaError

except ImportError:
    Draft202012Validator = None
    FormatChecker = None
    SchemaError = Exception


# ============================================================
# 오류 클래스
# ============================================================

class SchemaValidationError(Exception):
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
        "stage": "schema_validation",
        "code": code,
        "message": message,
    }

    if details:
        error["details"] = details

    return {
        "success": False,
        "stage": "schema_validation",
        "error": error,
    }


# ============================================================
# JSON 파일 처리
# ============================================================

def load_json_file(
    file_path: Path,
) -> dict[str, Any]:
    if not file_path.exists():
        raise SchemaValidationError(
            code="FILE_NOT_FOUND",
            message=(
                f"JSON 파일을 찾지 못했습니다: "
                f"{file_path}"
            ),
            details={
                "filePath": str(file_path),
            },
        )

    if not file_path.is_file():
        raise SchemaValidationError(
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
        raise SchemaValidationError(
            code="INVALID_JSON",
            message="JSON 형식이 올바르지 않습니다.",
            details={
                "filePath": str(file_path),
                "reason": str(error),
            },
        ) from error

    except OSError as error:
        raise SchemaValidationError(
            code="FILE_READ_ERROR",
            message="JSON 파일을 읽지 못했습니다.",
            details={
                "filePath": str(file_path),
                "reason": str(error),
            },
        ) from error

    if not isinstance(result, dict):
        raise SchemaValidationError(
            code="INVALID_JSON",
            message=(
                "JSON 최상위 값은 객체여야 합니다."
            ),
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
# Schema 구조 처리
# ============================================================

def ensure_jsonschema_installed() -> None:
    if (
        Draft202012Validator is None
        or FormatChecker is None
    ):
        raise SchemaValidationError(
            code="DEPENDENCY_NOT_FOUND",
            message=(
                "jsonschema 패키지가 설치되어 있지 "
                "않습니다."
            ),
            details={
                "installCommand":
                    "pip install jsonschema",
            },
        )


def get_root_json_schema(
    schema_document: dict[str, Any],
) -> dict[str, Any]:
    """
    다음 두 형태를 모두 지원합니다.

    1. Upstage response_format 구조

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

    2. 일반 JSON Schema 구조

    {
      "type": "object",
      "properties": {}
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
        root_schema = (
            schema_document["json_schema"]
            .get("schema")
        )

        if isinstance(root_schema, dict):
            return root_schema

    json_schema_wrapper = (
        schema_document.get(
            "json_schema"
        )
    )

    if isinstance(
        json_schema_wrapper,
        dict,
    ):
        root_schema = (
            json_schema_wrapper.get(
                "schema"
            )
        )

        if isinstance(root_schema, dict):
            return root_schema

    return schema_document


def validate_required_definitions(
    schema: dict[str, Any],
    path: str = "schema",
) -> list[dict[str, Any]]:
    """
    required에 적혀 있지만 properties에는 없는
    잘못된 스키마 필드를 검사합니다.
    """

    errors: list[dict[str, Any]] = []

    if not isinstance(schema, dict):
        return errors

    properties = schema.get(
        "properties"
    )

    required = schema.get(
        "required"
    )

    if isinstance(required, list):
        if not isinstance(properties, dict):
            errors.append(
                {
                    "path": path,
                    "message": (
                        "required가 있지만 properties가 "
                        "정의되어 있지 않습니다."
                    ),
                }
            )

        else:
            for field_name in required:
                if field_name not in properties:
                    errors.append(
                        {
                            "path": (
                                f"{path}.required."
                                f"{field_name}"
                            ),
                            "message": (
                                f"필수 필드 '{field_name}'가 "
                                "properties에 없습니다."
                            ),
                        }
                    )

    if isinstance(properties, dict):
        for field_name, field_schema in (
            properties.items()
        ):
            if isinstance(
                field_schema,
                dict,
            ):
                errors.extend(
                    validate_required_definitions(
                        schema=field_schema,
                        path=(
                            f"{path}.properties."
                            f"{field_name}"
                        ),
                    )
                )

    items = schema.get(
        "items"
    )

    if isinstance(items, dict):
        errors.extend(
            validate_required_definitions(
                schema=items,
                path=f"{path}.items",
            )
        )

    for composition_key in (
        "anyOf",
        "oneOf",
        "allOf",
    ):
        candidates = schema.get(
            composition_key
        )

        if not isinstance(
            candidates,
            list,
        ):
            continue

        for index, candidate in enumerate(
            candidates
        ):
            if not isinstance(
                candidate,
                dict,
            ):
                continue

            errors.extend(
                validate_required_definitions(
                    schema=candidate,
                    path=(
                        f"{path}."
                        f"{composition_key}"
                        f"[{index}]"
                    ),
                )
            )

    return errors


def validate_schema_definition(
    root_schema: dict[str, Any],
) -> None:
    ensure_jsonschema_installed()

    if not isinstance(
        root_schema,
        dict,
    ):
        raise SchemaValidationError(
            code="INVALID_SCHEMA",
            message=(
                "스키마 최상위 값은 "
                "객체여야 합니다."
            ),
        )

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
        raise SchemaValidationError(
            code="INVALID_SCHEMA",
            message=(
                "추출 스키마의 최상위 형식은 "
                "object여야 합니다."
            ),
            details={
                "rootType": schema_type,
            },
        )

    if not isinstance(
        properties,
        dict,
    ):
        raise SchemaValidationError(
            code="INVALID_SCHEMA",
            message=(
                "추출 스키마에 properties 객체가 "
                "없습니다."
            ),
        )

    custom_errors = (
        validate_required_definitions(
            root_schema
        )
    )

    if custom_errors:
        raise SchemaValidationError(
            code="INVALID_SCHEMA",
            message=(
                "required와 properties 정의가 "
                "일치하지 않습니다."
            ),
            details={
                "schemaErrors":
                    custom_errors,
            },
        )

    try:
        Draft202012Validator.check_schema(
            root_schema
        )

    except SchemaError as error:
        raise SchemaValidationError(
            code="INVALID_SCHEMA",
            message=(
                "schema.json 구조가 올바른 "
                "JSON Schema 형식이 아닙니다."
            ),
            details={
                "reason": error.message,
                "schemaPath": list(
                    error.absolute_schema_path
                ),
            },
        ) from error


# ============================================================
# 검증 오류 변환
# ============================================================

def make_data_path(
    path_parts: list[Any],
) -> str:
    result = "data"

    for part in path_parts:
        if isinstance(part, int):
            result += f"[{part}]"

        else:
            result += f".{part}"

    return result


def make_schema_path(
    path_parts: list[Any],
) -> str:
    result = "schema"

    for part in path_parts:
        if isinstance(part, int):
            result += f"[{part}]"

        else:
            result += f".{part}"

    return result


def safe_value_preview(
    value: Any,
    limit: int = 300,
) -> Any:
    if isinstance(
        value,
        (
            dict,
            list,
        ),
    ):
        try:
            text = json.dumps(
                value,
                ensure_ascii=False,
            )

        except TypeError:
            text = repr(value)

        if len(text) > limit:
            return text[:limit] + "..."

        return value

    if (
        isinstance(value, str)
        and len(value) > limit
    ):
        return value[:limit] + "..."

    return value


def convert_validation_error(
    error: Any,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "path": make_data_path(
            list(error.absolute_path)
        ),
        "schemaPath": make_schema_path(
            list(error.absolute_schema_path)
        ),
        "keyword": error.validator,
        "message": error.message,
        "value": safe_value_preview(
            error.instance
        ),
    }

    if error.validator_value is not None:
        result["expected"] = (
            error.validator_value
        )

    if error.context:
        result["subErrors"] = [
            {
                "path": make_data_path(
                    list(
                        child.absolute_path
                    )
                ),
                "keyword":
                    child.validator,
                "message":
                    child.message,
            }
            for child in error.context[:10]
        ]

    return result


def validation_sort_key(
    error: Any,
) -> tuple[str, str]:
    return (
        make_data_path(
            list(error.absolute_path)
        ),
        str(error.validator),
    )


# ============================================================
# 실제 data 검증
# ============================================================

def validate_document_data(
    data: dict[str, Any],
    schema_document: dict[str, Any],
) -> list[dict[str, Any]]:
    if not isinstance(
        data,
        dict,
    ):
        raise SchemaValidationError(
            code="INVALID_EXTRACTION_DATA",
            message=(
                "검증할 data의 최상위 값은 "
                "객체여야 합니다."
            ),
        )

    root_schema = get_root_json_schema(
        schema_document
    )

    validate_schema_definition(
        root_schema
    )

    validator = Draft202012Validator(
        schema=root_schema,
        format_checker=FormatChecker(),
    )

    errors = sorted(
        validator.iter_errors(data),
        key=validation_sort_key,
    )

    return [
        convert_validation_error(error)
        for error in errors
    ]


# ============================================================
# 정규화 결과에서 schema 불러오기
# ============================================================

def load_schema_from_result(
    normalized_result: dict[str, Any],
) -> dict[str, Any]:
    schema_info = normalized_result.get(
        "schema",
        {},
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
        raise SchemaValidationError(
            code="SCHEMA_NOT_FOUND",
            message=(
                "정규화 결과에 schema.path가 "
                "포함되어 있지 않습니다."
            ),
        )

    schema_path = (
        Path(schema_path_value)
        .expanduser()
    )

    if not schema_path.is_absolute():
        schema_path = (
            Path(__file__)
            .resolve()
            .parent
            / schema_path
        )

    schema_path = schema_path.resolve()

    return load_json_file(
        schema_path
    )


# ============================================================
# 전체 정규화 결과 검증
# ============================================================

def validate_extraction_result(
    normalized_result: dict[str, Any],
    schema_document: (
        dict[str, Any] | None
    ) = None,
) -> dict[str, Any]:
    """
    normalizer.py의 전체 반환 결과를 받아
    data 부분을 schema.json과 검증합니다.
    """

    try:
        if not isinstance(
            normalized_result,
            dict,
        ):
            raise SchemaValidationError(
                code=(
                    "INVALID_NORMALIZED_RESULT"
                ),
                message=(
                    "정규화 결과가 객체가 아닙니다."
                ),
            )

        # 앞 단계에서 이미 실패한 결과라면
        # 그대로 반환합니다.
        if not normalized_result.get(
            "success"
        ):
            return normalized_result

        data = normalized_result.get(
            "data"
        )

        if not isinstance(
            data,
            dict,
        ):
            raise SchemaValidationError(
                code="INVALID_EXTRACTION_DATA",
                message=(
                    "정규화 결과의 data가 "
                    "객체가 아닙니다."
                ),
            )

        if schema_document is None:
            schema_document = (
                load_schema_from_result(
                    normalized_result
                )
            )

        validation_errors = (
            validate_document_data(
                data=data,
                schema_document=(
                    schema_document
                ),
            )
        )

        result = copy.deepcopy(
            normalized_result
        )

        result["stage"] = (
            "schema_validation"
        )

        if validation_errors:
            result["success"] = False

            result["validation"] = {
                "success": False,
                "errorCount": len(
                    validation_errors
                ),
                "errors":
                    validation_errors,
            }

            result["error"] = {
                "stage":
                    "schema_validation",
                "code":
                    "INVALID_EXTRACTION_RESULT",
                "message": (
                    "정규화된 추출 결과가 "
                    "schema.json과 일치하지 "
                    "않습니다."
                ),
                "details": {
                    "errorCount": len(
                        validation_errors
                    ),
                    "validationErrors":
                        validation_errors,
                },
            }

            return result

        result["validation"] = {
            "success": True,
            "errorCount": 0,
            "errors": [],
        }

        result.pop(
            "error",
            None,
        )

        return result

    except SchemaValidationError as error:
        return make_error_response(
            code=error.code,
            message=error.message,
            details=error.details,
        )

    except Exception as error:
        return make_error_response(
            code=(
                "UNEXPECTED_VALIDATION_ERROR"
            ),
            message=(
                "스키마 검증 중 예상하지 못한 "
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
            "normalizer.py 결과의 data가 "
            "schema.json과 일치하는지 "
            "검증합니다."
        )
    )

    parser.add_argument(
        "normalized_json",
        type=Path,
        help=(
            "normalizer.py가 생성한 "
            "결과 JSON 파일"
        ),
    )

    parser.add_argument(
        "--schema",
        type=Path,
        help=(
            "직접 지정할 schema.json 경로. "
            "생략하면 normalized_json의 "
            "schema.path를 사용합니다."
        ),
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="검증 결과 저장 경로",
    )

    args = parser.parse_args()

    try:
        normalized_result = load_json_file(
            args.normalized_json
            .expanduser()
            .resolve()
        )

        schema_document = None

        if args.schema:
            schema_document = load_json_file(
                args.schema
                .expanduser()
                .resolve()
            )

        result = validate_extraction_result(
            normalized_result=(
                normalized_result
            ),
            schema_document=(
                schema_document
            ),
        )

    except SchemaValidationError as error:
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
            f"\n검증 결과 저장 완료: "
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