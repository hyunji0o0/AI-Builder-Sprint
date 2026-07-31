from __future__ import annotations

import argparse
import copy
import json
import sys
import time
from pathlib import Path
from typing import Any

from document_parser import parse_document
from document_classifier import classify_document
from information_extractor import extract_document_information
from normalizer import normalize_extraction_result
from schema_validator import validate_extraction_result


PROJECT_ROOT = Path(__file__).resolve().parents[4]


# ============================================================
# JSON 파일 저장
# ============================================================

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
# 파이프라인 공통 오류
# ============================================================

def make_pipeline_error_response(
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "stage": "pipeline",
        "code": code,
        "message": message,
    }

    if details:
        error["details"] = details

    return {
        "success": False,
        "stage": "pipeline",
        "error": error,
    }


# ============================================================
# 시간 계산
# ============================================================

def calculate_duration_ms(
    started_at: float,
) -> int:
    return round(
        (
            time.perf_counter()
            - started_at
        )
        * 1000
    )


def create_stage_status(
    success: bool,
    duration_ms: int,
) -> dict[str, Any]:
    return {
        "success": success,
        "durationMs": duration_ms,
    }


# ============================================================
# Parse 결과 요약
# ============================================================

def build_parse_summary(
    parse_result: dict[str, Any],
    include_content: bool = False,
    include_raw_response: bool = False,
) -> dict[str, Any]:
    parse_data = parse_result.get(
        "parse",
        {},
    )

    if not isinstance(
        parse_data,
        dict,
    ):
        parse_data = {}

    summary: dict[str, Any] = {
        "success": bool(
            parse_result.get("success")
        ),
        "api": parse_data.get(
            "api",
            "document-parse",
        ),
        "model": parse_data.get(
            "model",
            "document-parse",
        ),
        "ocr": parse_data.get(
            "ocr",
            "auto",
        ),
        "pageCount": parse_data.get(
            "pageCount",
            0,
        ),
        "elementCount": parse_data.get(
            "elementCount",
            0,
        ),
    }

    if include_content:
        summary["classificationText"] = (
            parse_data.get(
                "classificationText",
                "",
            )
        )

        summary["content"] = (
            parse_data.get(
                "content",
                {},
            )
        )

        summary["elements"] = (
            parse_data.get(
                "elements",
                [],
            )
        )

        summary["usage"] = (
            parse_data.get(
                "usage",
                {},
            )
        )

    if (
        include_raw_response
        and "rawResponse" in parse_result
    ):
        summary["rawResponse"] = (
            parse_result["rawResponse"]
        )

    return summary


# ============================================================
# 파이프라인 정보 추가
# ============================================================

def attach_pipeline_metadata(
    result: dict[str, Any],
    *,
    pipeline_success: bool,
    started_at: float,
    stage_statuses: dict[str, Any],
    completed_stages: list[str],
    failed_stage: str = "",
    parse_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    final_result = copy.deepcopy(
        result
    )

    if (
        parse_summary is not None
        and "parse" not in final_result
    ):
        final_result["parse"] = (
            parse_summary
        )

    pipeline_info: dict[str, Any] = {
        "success": pipeline_success,
        "completedStages":
            completed_stages,
        "totalDurationMs":
            calculate_duration_ms(
                started_at
            ),
        "stages": stage_statuses,
    }

    if failed_stage:
        pipeline_info["failedStage"] = (
            failed_stage
        )

    final_result["pipeline"] = (
        pipeline_info
    )

    return final_result


def get_failed_stage(
    result: dict[str, Any],
    fallback_stage: str,
) -> str:
    error = result.get(
        "error",
        {},
    )

    if isinstance(error, dict):
        error_stage = str(
            error.get(
                "stage",
                "",
            )
        ).strip()

        if error_stage:
            return error_stage

    result_stage = str(
        result.get(
            "stage",
            "",
        )
    ).strip()

    return (
        result_stage
        or fallback_stage
    )


# ============================================================
# 최종 문서 분석 파이프라인
# ============================================================

def analyze_document(
    file_path: str | Path,
    *,
    allow_confirmation: bool = False,
    use_financial_api: bool = True,
    include_extract_raw_response: bool = False,
    include_parse_content: bool = False,
    include_parse_raw_response: bool = False,
    include_parse_base64: bool = False,
) -> dict[str, Any]:
    """
    이미지 또는 PDF 한 개를 입력받아 다음 순서로 처리한다.

    1. Upstage Document Parse
    2. 문서 종류 자동 분류
    3. 금융기관 세부 분류
    4. schema.json 자동 선택
    5. Information Extract
    6. 추출 결과 정규화
    7. JSON Schema 검증
    8. 최종 JSON 반환

    AI Agent는 이 함수의 반환 JSON을 입력으로 사용한다.
    """

    pipeline_started_at = (
        time.perf_counter()
    )

    stage_statuses: dict[
        str,
        dict[str, Any]
    ] = {}

    completed_stages: list[str] = []

    parse_summary: (
        dict[str, Any] | None
    ) = None

    try:
        input_path = (
            Path(file_path)
            .expanduser()
            .resolve()
        )

        # ----------------------------------------------------
        # 1. Document Parse
        # ----------------------------------------------------

        stage_started_at = (
            time.perf_counter()
        )

        parse_result = parse_document(
            file_path=input_path,
            include_raw_response=(
                include_parse_raw_response
            ),
            include_base64=(
                include_parse_base64
            ),
        )

        parse_success = bool(
            parse_result.get(
                "success"
            )
        )

        stage_statuses[
            "document_parse"
        ] = create_stage_status(
            success=parse_success,
            duration_ms=(
                calculate_duration_ms(
                    stage_started_at
                )
            ),
        )

        if not parse_success:
            return attach_pipeline_metadata(
                result=parse_result,
                pipeline_success=False,
                started_at=(
                    pipeline_started_at
                ),
                stage_statuses=(
                    stage_statuses
                ),
                completed_stages=(
                    completed_stages
                ),
                failed_stage=(
                    get_failed_stage(
                        parse_result,
                        "document_parse",
                    )
                ),
            )

        completed_stages.append(
            "document_parse"
        )

        # Base64 결과를 요청했다면 Parse 내용도
        # 최종 결과에 포함해야 확인할 수 있다.
        effective_include_parse_content = (
            include_parse_content
            or include_parse_base64
        )

        parse_summary = (
            build_parse_summary(
                parse_result=(
                    parse_result
                ),
                include_content=(
                    effective_include_parse_content
                ),
                include_raw_response=(
                    include_parse_raw_response
                ),
            )
        )

        # ----------------------------------------------------
        # 2. 문서 종류 자동 분류
        # ----------------------------------------------------

        stage_started_at = (
            time.perf_counter()
        )

        classification_result = (
            classify_document(
                file_path=input_path,
                parse_result=parse_result,
                use_financial_api=(
                    use_financial_api
                ),
            )
        )

        classification_success = bool(
            classification_result.get(
                "success"
            )
        )

        stage_statuses[
            "document_classification"
        ] = create_stage_status(
            success=(
                classification_success
            ),
            duration_ms=(
                calculate_duration_ms(
                    stage_started_at
                )
            ),
        )

        if not classification_success:
            return attach_pipeline_metadata(
                result=(
                    classification_result
                ),
                pipeline_success=False,
                started_at=(
                    pipeline_started_at
                ),
                stage_statuses=(
                    stage_statuses
                ),
                completed_stages=(
                    completed_stages
                ),
                failed_stage=(
                    get_failed_stage(
                        classification_result,
                        "document_classification",
                    )
                ),
                parse_summary=(
                    parse_summary
                ),
            )

        completed_stages.append(
            "document_classification"
        )

        # ----------------------------------------------------
        # 3. Information Extract
        # ----------------------------------------------------

        stage_started_at = (
            time.perf_counter()
        )

        extraction_result = (
            extract_document_information(
                file_path=input_path,
                classification_result=(
                    classification_result
                ),
                allow_confirmation=(
                    allow_confirmation
                ),
                include_raw_response=(
                    include_extract_raw_response
                ),
            )
        )

        extraction_success = bool(
            extraction_result.get(
                "success"
            )
        )

        stage_statuses[
            "information_extract"
        ] = create_stage_status(
            success=extraction_success,
            duration_ms=(
                calculate_duration_ms(
                    stage_started_at
                )
            ),
        )

        if not extraction_success:
            return attach_pipeline_metadata(
                result=extraction_result,
                pipeline_success=False,
                started_at=(
                    pipeline_started_at
                ),
                stage_statuses=(
                    stage_statuses
                ),
                completed_stages=(
                    completed_stages
                ),
                failed_stage=(
                    get_failed_stage(
                        extraction_result,
                        "information_extract",
                    )
                ),
                parse_summary=(
                    parse_summary
                ),
            )

        completed_stages.append(
            "information_extract"
        )

        # ----------------------------------------------------
        # 4. 정규화
        # ----------------------------------------------------

        stage_started_at = (
            time.perf_counter()
        )

        normalized_result = (
            normalize_extraction_result(
                extraction_result=(
                    extraction_result
                )
            )
        )

        normalization_success = bool(
            normalized_result.get(
                "success"
            )
        )

        stage_statuses[
            "normalization"
        ] = create_stage_status(
            success=(
                normalization_success
            ),
            duration_ms=(
                calculate_duration_ms(
                    stage_started_at
                )
            ),
        )

        if not normalization_success:
            return attach_pipeline_metadata(
                result=normalized_result,
                pipeline_success=False,
                started_at=(
                    pipeline_started_at
                ),
                stage_statuses=(
                    stage_statuses
                ),
                completed_stages=(
                    completed_stages
                ),
                failed_stage=(
                    get_failed_stage(
                        normalized_result,
                        "normalization",
                    )
                ),
                parse_summary=(
                    parse_summary
                ),
            )

        completed_stages.append(
            "normalization"
        )

        # ----------------------------------------------------
        # 5. JSON Schema 검증
        # ----------------------------------------------------

        stage_started_at = (
            time.perf_counter()
        )

        validated_result = (
            validate_extraction_result(
                normalized_result=(
                    normalized_result
                )
            )
        )

        validation_success = bool(
            validated_result.get(
                "success"
            )
        )

        stage_statuses[
            "schema_validation"
        ] = create_stage_status(
            success=validation_success,
            duration_ms=(
                calculate_duration_ms(
                    stage_started_at
                )
            ),
        )

        if not validation_success:
            return attach_pipeline_metadata(
                result=validated_result,
                pipeline_success=False,
                started_at=(
                    pipeline_started_at
                ),
                stage_statuses=(
                    stage_statuses
                ),
                completed_stages=(
                    completed_stages
                ),
                failed_stage=(
                    get_failed_stage(
                        validated_result,
                        "schema_validation",
                    )
                ),
                parse_summary=(
                    parse_summary
                ),
            )

        completed_stages.append(
            "schema_validation"
        )

        # ----------------------------------------------------
        # 6. 최종 성공 결과
        # ----------------------------------------------------

        final_result = copy.deepcopy(
            validated_result
        )

        final_result["stage"] = (
            "completed"
        )

        final_result["parse"] = (
            parse_summary
        )

        final_result = (
            attach_pipeline_metadata(
                result=final_result,
                pipeline_success=True,
                started_at=(
                    pipeline_started_at
                ),
                stage_statuses=(
                    stage_statuses
                ),
                completed_stages=(
                    completed_stages
                ),
                parse_summary=(
                    parse_summary
                ),
            )
        )

        return final_result

    except Exception as error:
        unexpected_result = (
            make_pipeline_error_response(
                code=(
                    "UNEXPECTED_PIPELINE_ERROR"
                ),
                message=(
                    "문서 분석 파이프라인 실행 중 "
                    "예상하지 못한 오류가 "
                    "발생했습니다."
                ),
                details={
                    "reason": str(error),
                    "exceptionType":
                        type(error).__name__,
                },
            )
        )

        return attach_pipeline_metadata(
            result=unexpected_result,
            pipeline_success=False,
            started_at=(
                pipeline_started_at
            ),
            stage_statuses=(
                stage_statuses
            ),
            completed_stages=(
                completed_stages
            ),
            failed_stage="pipeline",
            parse_summary=(
                parse_summary
            ),
        )


# ============================================================
# CLI
# ============================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "이미지 또는 PDF를 입력받아 "
            "Document Parse, 자동 분류, "
            "정보 추출, 정규화, 검증을 "
            "한 번에 실행합니다."
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
        help="최종 결과 JSON 저장 경로",
    )

    parser.add_argument(
        "--allow-confirmation",
        action="store_true",
        help=(
            "분류 결과의 needsConfirmation이 "
            "true여도 정보 추출을 계속합니다."
        ),
    )

    parser.add_argument(
        "--skip-financial-api",
        action="store_true",
        help=(
            "금융기관 Information Extract 분류를 "
            "생략하고 Parse 텍스트 규칙만 사용합니다."
        ),
    )

    parser.add_argument(
        "--include-extract-raw",
        action="store_true",
        help=(
            "Information Extract 원본 응답을 "
            "최종 결과에 포함합니다."
        ),
    )

    parser.add_argument(
        "--include-parse-content",
        action="store_true",
        help=(
            "Document Parse의 HTML, Markdown, "
            "텍스트, elements를 최종 결과에 "
            "포함합니다."
        ),
    )

    parser.add_argument(
        "--include-parse-raw",
        action="store_true",
        help=(
            "Document Parse 원본 API 응답을 "
            "최종 결과에 포함합니다."
        ),
    )

    parser.add_argument(
        "--include-base64",
        action="store_true",
        help=(
            "Document Parse의 표·그림 Base64를 "
            "포함합니다. 결과 JSON 크기가 "
            "매우 커질 수 있습니다."
        ),
    )

    args = parser.parse_args()

    result = analyze_document(
        file_path=args.file,
        allow_confirmation=(
            args.allow_confirmation
        ),
        use_financial_api=(
            not args.skip_financial_api
        ),
        include_extract_raw_response=(
            args.include_extract_raw
        ),
        include_parse_content=(
            args.include_parse_content
        ),
        include_parse_raw_response=(
            args.include_parse_raw
        ),
        include_parse_base64=(
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
        save_json_file(
            output_path=args.output,
            data=result,
        )

        print(
            f"\n최종 결과 저장 완료: "
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
