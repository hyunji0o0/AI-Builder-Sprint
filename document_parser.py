from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent

UPSTAGE_DOCUMENT_PARSE_URL = (
    "https://api.upstage.ai/v1/document-digitization"
)

SUPPORTED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".pdf",
}


class DocumentParseError(Exception):
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


def validate_file(file_path: Path) -> None:
    if not file_path.exists():
        raise DocumentParseError(
            code="FILE_NOT_FOUND",
            message=f"파일을 찾지 못했습니다: {file_path}",
        )

    if not file_path.is_file():
        raise DocumentParseError(
            code="FILE_NOT_FOUND",
            message="입력 경로가 파일이 아닙니다.",
        )

    extension = file_path.suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise DocumentParseError(
            code="UNSUPPORTED_FILE_TYPE",
            message=f"지원하지 않는 파일 형식입니다: {extension}",
            details={
                "supportedExtensions": sorted(
                    SUPPORTED_EXTENSIONS
                )
            },
        )


def parse_document(
    file_path: str | Path,
) -> dict[str, Any]:
    try:
        input_path = Path(file_path).expanduser().resolve()

        validate_file(input_path)

        load_dotenv(PROJECT_ROOT / ".env")

        api_key = os.getenv(
            "UPSTAGE_API_KEY",
            "",
        ).strip()

        if not api_key:
            raise DocumentParseError(
                code="UPSTAGE_API_ERROR",
                message=(
                    ".env에 UPSTAGE_API_KEY가 "
                    "설정되어 있지 않습니다."
                ),
            )

        headers = {
            "Authorization": f"Bearer {api_key}",
        }

        data = {
            "model": "document-parse",
            "output_formats": '["html", "text"]',
            "base64_encoding": '["table", "figure"]',
            "ocr": "auto",
        }

        with input_path.open("rb") as file:
            files = {
                "document": (
                    input_path.name,
                    file,
                )
            }

            response = requests.post(
                UPSTAGE_DOCUMENT_PARSE_URL,
                headers=headers,
                data=data,
                files=files,
                timeout=(10, 180),
            )

        if not response.ok:
            raise DocumentParseError(
                code="UPSTAGE_API_ERROR",
                message=(
                    "Upstage Document Parse API가 "
                    "오류 응답을 반환했습니다."
                ),
                details={
                    "statusCode": response.status_code,
                    "responseBody": response.text[:2000],
                },
            )

        try:
            response_body = response.json()

        except ValueError as error:
            raise DocumentParseError(
                code="INVALID_PARSE_RESULT",
                message=(
                    "Document Parse 응답이 "
                    "JSON 형식이 아닙니다."
                ),
                details={
                    "responseBody": response.text[:2000],
                },
            ) from error

        if not isinstance(response_body, dict):
            raise DocumentParseError(
                code="INVALID_PARSE_RESULT",
                message=(
                    "Document Parse 결과의 "
                    "최상위 값이 객체가 아닙니다."
                ),
            )

        content = response_body.get("content", {})

        return {
            "success": True,
            "fileName": input_path.name,
            "filePath": str(input_path),
            "parse": {
                "content": content,
                "elements": response_body.get(
                    "elements",
                    [],
                ),
                "usage": response_body.get(
                    "usage",
                    {},
                ),
            },
            "rawResponse": response_body,
        }

    except DocumentParseError as error:
        return make_error_response(
            code=error.code,
            message=error.message,
            details=error.details,
        )

    except Exception as error:
        return make_error_response(
            code="INVALID_PARSE_RESULT",
            message=(
                "문서 파싱 중 예상하지 못한 "
                "오류가 발생했습니다."
            ),
            details={
                "reason": str(error),
                "exceptionType": type(error).__name__,
            },
        )


def save_json(
    output_path: Path,
    data: dict[str, Any],
) -> None:
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


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Upstage Document Parse 테스트"
    )

    parser.add_argument(
        "file",
        type=Path,
        help="분석할 이미지 또는 PDF",
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="결과 JSON 저장 경로",
    )

    args = parser.parse_args()

    result = parse_document(args.file)

    print(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2,
        )
    )

    if args.output:
        save_json(
            output_path=args.output,
            data=result,
        )

        print(
            f"\n결과 저장 완료: {args.output}",
            file=sys.stderr,
        )

    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())