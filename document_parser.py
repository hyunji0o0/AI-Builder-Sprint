from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parent

UPSTAGE_DOCUMENT_PARSE_URL = (
    "https://api.upstage.ai/v1/document-digitization"
)

UPSTAGE_DOCUMENT_PARSE_MODEL = "document-parse"

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
        "stage": "document_parse",
        "code": code,
        "message": message,
    }

    if details:
        error["details"] = details

    return {
        "success": False,
        "error": error,
    }


def validate_file(
    file_path: Path,
) -> None:
    if not file_path.exists():
        raise DocumentParseError(
            code="FILE_NOT_FOUND",
            message=f"파일을 찾지 못했습니다: {file_path}",
        )

    if not file_path.is_file():
        raise DocumentParseError(
            code="INVALID_FILE_PATH",
            message="입력 경로가 파일이 아닙니다.",
        )

    extension = file_path.suffix.lower()

    if extension not in SUPPORTED_EXTENSIONS:
        raise DocumentParseError(
            code="UNSUPPORTED_FILE_TYPE",
            message=(
                f"지원하지 않는 파일 형식입니다: "
                f"{extension or '(확장자 없음)'}"
            ),
            details={
                "supportedExtensions": sorted(
                    SUPPORTED_EXTENSIONS
                )
            },
        )

    if file_path.stat().st_size == 0:
        raise DocumentParseError(
            code="EMPTY_FILE",
            message="입력 파일의 크기가 0바이트입니다.",
        )


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
        raise DocumentParseError(
            code="API_KEY_NOT_FOUND",
            message=(
                ".env 파일에 UPSTAGE_API_KEY가 "
                "설정되어 있지 않습니다."
            ),
        )

    return api_key


def remove_html_tags(
    html_content: str,
) -> str:
    if not html_content:
        return ""

    text = re.sub(
        r"<script\b[^>]*>.*?</script>",
        " ",
        html_content,
        flags=re.IGNORECASE | re.DOTALL,
    )

    text = re.sub(
        r"<style\b[^>]*>.*?</style>",
        " ",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )

    text = re.sub(
        r"<[^>]+>",
        " ",
        text,
    )

    text = html.unescape(text)

    return normalize_text(text)


def remove_markdown_syntax(
    markdown_content: str,
) -> str:
    if not markdown_content:
        return ""

    text = markdown_content

    # 이미지
    text = re.sub(
        r"!\[[^\]]*]\([^)]*\)",
        " ",
        text,
    )

    # 링크는 표시 문자열만 유지
    text = re.sub(
        r"\[([^\]]+)]\([^)]*\)",
        r"\1",
        text,
    )

    # 제목·강조·코드 표시 제거
    text = re.sub(
        r"[#*_`>|~]+",
        " ",
        text,
    )

    return normalize_text(text)


def normalize_text(
    value: str,
) -> str:
    if not value:
        return ""

    value = value.replace(
        "\u00a0",
        " ",
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    )

    return value.strip()


def build_classification_text(
    content: dict[str, Any],
) -> str:
    """
    Document Parse 결과에서 문서 분류에 사용할
    텍스트를 생성한다.

    우선순위:
    1. text
    2. markdown
    3. html
    """

    plain_text = content.get(
        "text",
        "",
    )

    if isinstance(plain_text, str):
        plain_text = normalize_text(
            plain_text
        )

        if plain_text:
            return plain_text

    markdown_content = content.get(
        "markdown",
        "",
    )

    if isinstance(markdown_content, str):
        markdown_text = remove_markdown_syntax(
            markdown_content
        )

        if markdown_text:
            return markdown_text

    html_content = content.get(
        "html",
        "",
    )

    if isinstance(html_content, str):
        return remove_html_tags(
            html_content
        )

    return ""


def request_document_parse(
    api_key: str,
    file_path: Path,
    include_base64: bool = False,
    max_retries: int = 2,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    request_data: dict[str, str] = {
        "model": UPSTAGE_DOCUMENT_PARSE_MODEL,
        "output_formats": json.dumps(
            [
                "html",
                "markdown",
                "text",
            ]
        ),
        "ocr": "auto",
    }

    # 표·그림 이미지를 Base64로 포함하면
    # 결과 JSON 크기가 매우 커질 수 있으므로
    # 기본값은 비활성화한다.
    if include_base64:
        request_data["base64_encoding"] = (
            json.dumps(
                [
                    "table",
                    "figure",
                ]
            )
        )

    last_error: Exception | None = None

    for attempt in range(
        max_retries + 1
    ):
        try:
            with file_path.open(
                "rb"
            ) as document_file:
                files = {
                    "document": (
                        file_path.name,
                        document_file,
                    )
                }

                response = requests.post(
                    UPSTAGE_DOCUMENT_PARSE_URL,
                    headers=headers,
                    data=request_data,
                    files=files,
                    timeout=(15, 180),
                )

            if response.ok:
                try:
                    response_body = (
                        response.json()
                    )

                except ValueError as error:
                    raise DocumentParseError(
                        code="INVALID_API_RESPONSE",
                        message=(
                            "Document Parse 응답이 "
                            "JSON 형식이 아닙니다."
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
                    raise DocumentParseError(
                        code="INVALID_API_RESPONSE",
                        message=(
                            "Document Parse 응답의 "
                            "최상위 값이 객체가 아닙니다."
                        ),
                    )

                return response_body

            if (
                response.status_code
                in RETRYABLE_STATUS_CODES
                and attempt < max_retries
            ):
                time.sleep(
                    2 ** attempt
                )
                continue

            raise DocumentParseError(
                code="UPSTAGE_PARSE_API_ERROR",
                message=(
                    "Upstage Document Parse API가 "
                    "오류 응답을 반환했습니다."
                ),
                details={
                    "statusCode":
                        response.status_code,
                    "responseBody":
                        response.text[:2000],
                },
            )

        except DocumentParseError:
            raise

        except requests.Timeout as error:
            last_error = error

            if attempt < max_retries:
                time.sleep(
                    2 ** attempt
                )
                continue

            raise DocumentParseError(
                code="UPSTAGE_PARSE_TIMEOUT",
                message=(
                    "Document Parse API 요청 시간이 "
                    "초과되었습니다."
                ),
                details={
                    "attempts":
                        max_retries + 1,
                },
            ) from error

        except requests.RequestException as error:
            last_error = error

            if attempt < max_retries:
                time.sleep(
                    2 ** attempt
                )
                continue

            raise DocumentParseError(
                code="UPSTAGE_PARSE_NETWORK_ERROR",
                message=(
                    "Document Parse API에 "
                    "연결하지 못했습니다."
                ),
                details={
                    "reason": str(error),
                    "attempts":
                        max_retries + 1,
                },
            ) from error

    raise DocumentParseError(
        code="UPSTAGE_PARSE_API_ERROR",
        message="Document Parse 요청에 실패했습니다.",
        details={
            "reason": (
                str(last_error)
                if last_error
                else "알 수 없는 오류"
            ),
        },
    )


def parse_document(
    file_path: str | Path,
    include_raw_response: bool = False,
    include_base64: bool = False,
) -> dict[str, Any]:
    """
    이미지 또는 PDF를 Upstage Document Parse로 분석한다.

    이 함수는 문서를 분류하지 않는다.
    분류에 사용할 classificationText만 생성한다.
    """

    try:
        input_path = (
            Path(file_path)
            .expanduser()
            .resolve()
        )

        validate_file(
            input_path
        )

        api_key = load_api_key()

        response_body = request_document_parse(
            api_key=api_key,
            file_path=input_path,
            include_base64=include_base64,
        )

        content = response_body.get(
            "content",
            {},
        )

        if not isinstance(content, dict):
            raise DocumentParseError(
                code="INVALID_PARSE_RESULT",
                message=(
                    "Document Parse 결과의 content가 "
                    "객체 형식이 아닙니다."
                ),
            )

        elements = response_body.get(
            "elements",
            [],
        )

        if not isinstance(elements, list):
            elements = []

        usage = response_body.get(
            "usage",
            {},
        )

        if not isinstance(usage, dict):
            usage = {}

        classification_text = (
            build_classification_text(
                content
            )
        )

        if not classification_text:
            raise DocumentParseError(
                code="EMPTY_PARSE_RESULT",
                message=(
                    "Document Parse 결과에서 "
                    "분류에 사용할 텍스트를 "
                    "찾지 못했습니다."
                ),
            )

        result: dict[str, Any] = {
            "success": True,
            "stage": "document_parse",
            "file": {
                "name": input_path.name,
                "path": str(input_path),
                "extension":
                    input_path.suffix.lower(),
                "sizeBytes":
                    input_path.stat().st_size,
            },
            "parse": {
                "api": response_body.get(
                    "api",
                    "document-parse",
                ),
                "model": response_body.get(
                    "model",
                    UPSTAGE_DOCUMENT_PARSE_MODEL,
                ),
                "ocr": response_body.get(
                    "ocr",
                    "auto",
                ),
                "pageCount": usage.get(
                    "pages",
                    0,
                ),
                "elementCount": len(
                    elements
                ),
                "classificationText":
                    classification_text,
                "content": content,
                "elements": elements,
                "usage": usage,
            },
        }

        if include_raw_response:
            result["rawResponse"] = (
                response_body
            )

        return result

    except DocumentParseError as error:
        return make_error_response(
            code=error.code,
            message=error.message,
            details=error.details,
        )

    except Exception as error:
        return make_error_response(
            code="UNEXPECTED_PARSE_ERROR",
            message=(
                "문서 파싱 중 예상하지 못한 "
                "오류가 발생했습니다."
            ),
            details={
                "reason": str(error),
                "exceptionType":
                    type(error).__name__,
            },
        )


def save_json(
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


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Upstage Document Parse로 "
            "이미지 또는 PDF 분석"
        )
    )

    parser.add_argument(
        "file",
        type=Path,
        help="분석할 이미지 또는 PDF 파일",
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="결과 JSON 저장 경로",
    )

    parser.add_argument(
        "--include-raw",
        action="store_true",
        help="원본 API 응답을 결과에 포함",
    )

    parser.add_argument(
        "--include-base64",
        action="store_true",
        help=(
            "표와 그림을 Base64로 포함 "
            "(결과 파일이 매우 커질 수 있음)"
        ),
    )

    args = parser.parse_args()

    result = parse_document(
        file_path=args.file,
        include_raw_response=(
            args.include_raw
        ),
        include_base64=(
            args.include_base64
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
        save_json(
            output_path=args.output,
            data=result,
        )

        print(
            f"\n결과 저장 완료: "
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