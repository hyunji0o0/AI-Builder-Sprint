from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from document_analysis_pipeline import analyze_document


PROJECT_ROOT = Path(__file__).resolve().parent

DEFAULT_OUTPUT_DIR = (
    PROJECT_ROOT
    / "tests"
    / "results"
    / "pipeline"
)


# ============================================================
# 테스트 목록
# ============================================================

TEST_CASES: list[dict[str, str]] = [
    {
        "name": "death_certificate",
        "file": (
            "document/death_certificate/"
            "sample.png"
        ),
        "schema": (
            "document/death_certificate/"
            "schema.json"
        ),
        "expectedDocumentType":
            "death_certificate",
        "expectedOrganizationKey": "",
        "expectedSourceOrganization": "",
    },
    {
        "name": "death_report",
        "file": (
            "document/death_report/"
            "sample.png"
        ),
        "schema": (
            "document/death_report/"
            "schema.json"
        ),
        "expectedDocumentType":
            "death_report",
        "expectedOrganizationKey": "",
        "expectedSourceOrganization": "",
    },

    # --------------------------------------------------------
    # 금융기관
    # --------------------------------------------------------

    {
        "name": "bank",
        "file": (
            "document/financial/bank/"
            "sample.png"
        ),
        "schema": (
            "document/financial/bank/"
            "schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey": "bank",
        "expectedSourceOrganization":
            "은행연합회",
    },
    {
        "name": "life_insurance",
        "file": (
            "document/financial/"
            "life_insurance/sample.png"
        ),
        "schema": (
            "document/financial/"
            "life_insurance/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "life_insurance",
        "expectedSourceOrganization":
            "생명보험협회",
    },
    {
        "name": "nonlife_insurance",
        "file": (
            "document/financial/"
            "nonlife_insurance/sample.png"
        ),
        "schema": (
            "document/financial/"
            "nonlife_insurance/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "nonlife_insurance",
        "expectedSourceOrganization":
            "손해보험협회",
    },
    {
        "name": "financial_investment",
        "file": (
            "document/financial/"
            "financial_investment/sample.png"
        ),
        "schema": (
            "document/financial/"
            "financial_investment/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "financial_investment",
        "expectedSourceOrganization":
            "금융투자협회",
    },
    {
        "name": "credit_finance",
        "file": (
            "document/financial/"
            "credit_finance/sample.png"
        ),
        "schema": (
            "document/financial/"
            "credit_finance/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "credit_finance",
        "expectedSourceOrganization":
            "여신금융협회",
    },
    {
        "name": "korea_post",
        "file": (
            "document/financial/"
            "korea_post/sample.png"
        ),
        "schema": (
            "document/financial/"
            "korea_post/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "korea_post",
        "expectedSourceOrganization":
            "우정사업본부",
    },
    {
        "name": "savings_bank",
        "file": (
            "document/financial/"
            "saving_bank/sample.png"
        ),
        "schema": (
            "document/financial/"
            "saving_bank/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "savings_bank",
        "expectedSourceOrganization":
            "저축은행중앙회",
    },
    {
        "name": "community_credit",
        "file": (
            "document/financial/"
            "community_credit/sample.png"
        ),
        "schema": (
            "document/financial/"
            "community_credit/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "community_credit",
        "expectedSourceOrganization":
            "새마을금고중앙회",
    },
    {
        "name": "forestry_cooperative",
        "file": (
            "document/financial/"
            "forestry_cooperative/sample.png"
        ),
        "schema": (
            "document/financial/"
            "forestry_cooperative/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "forestry_cooperative",
        "expectedSourceOrganization":
            "산림조합중앙회",
    },
    {
        "name": "credit_union",
        "file": (
            "document/financial/"
            "credit_union/sample.png"
        ),
        "schema": (
            "document/financial/"
            "credit_union/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "credit_union",
        "expectedSourceOrganization":
            "신협중앙회",
    },
    {
        "name": "securities_depository",
        "file": (
            "document/financial/"
            "korea_security/sample.png"
        ),
        "schema": (
            "document/financial/"
            "korea_security/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "securities_depository",
        "expectedSourceOrganization":
            "한국예탁결제원",
    },
    {
        "name": "consumer_finance",
        "file": (
            "document/financial/"
            "consumer_finance/sample.png"
        ),
        "schema": (
            "document/financial/"
            "consumer_finance/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "consumer_finance",
        "expectedSourceOrganization":
            "대부금융협회",
    },
    {
        "name": "deposit_insurance",
        "file": (
            "document/financial/"
            "deposit/sample.png"
        ),
        "schema": (
            "document/financial/"
            "deposit/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "deposit_insurance",
        "expectedSourceOrganization":
            "예금보험공사",
    },
    {
        "name": "credit_information",
        "file": (
            "document/financial/"
            "credit_information/sample.png"
        ),
        "schema": (
            "document/financial/"
            "credit_information/schema.json"
        ),
        "expectedDocumentType":
            "financial_inquiry_result",
        "expectedOrganizationKey":
            "credit_information",
        "expectedSourceOrganization":
            "신용정보원",
    },

    # --------------------------------------------------------
    # 안심상속 비금융 조회 결과
    # --------------------------------------------------------

    {
        "name": "land_inquiry_result",
        "file": (
            "document/land_inquiry_result/"
            "sample.png"
        ),
        "schema": (
            "document/land_inquiry_result/"
            "schema.json"
        ),
        "expectedDocumentType":
            "land_inquiry_result",
        "expectedOrganizationKey": "",
        "expectedSourceOrganization": "",
    },
    {
        "name": "vehicle_inquiry_result",
        "file": (
            "document/vehicle_inquiry_result/"
            "sample.png"
        ),
        "schema": (
            "document/vehicle_inquiry_result/"
            "schema.json"
        ),
        "expectedDocumentType":
            "vehicle_inquiry_result",
        "expectedOrganizationKey": "",
        "expectedSourceOrganization": "",
    },
    {
        "name": "tax_inquiry_result",
        "file": (
            "document/tax_inquiry_result/"
            "sample.png"
        ),
        "schema": (
            "document/tax_inquiry_result/"
            "schema.json"
        ),
        "expectedDocumentType":
            "tax_inquiry_result",
        "expectedOrganizationKey": "",
        "expectedSourceOrganization": "",
    },
]


# ============================================================
# JSON 저장
# ============================================================

def save_json_file(
    path: Path,
    data: dict[str, Any],
) -> None:
    path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with path.open(
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
# 계산 및 출력
# ============================================================

def calculate_rate(
    numerator: int,
    denominator: int,
) -> float | None:
    if denominator == 0:
        return None

    return round(
        numerator
        / denominator
        * 100,
        2,
    )


def format_rate(
    value: float | None,
) -> str:
    if value is None:
        return "-"

    return f"{value:.2f}%"


# ============================================================
# 테스트 실행 전 파일 검사
# ============================================================

def check_required_file(
    path: Path,
    label: str,
) -> str | None:
    if not path.exists():
        return (
            f"{label} 파일 없음: "
            f"{path}"
        )

    if not path.is_file():
        return (
            f"{label} 경로가 파일이 아님: "
            f"{path}"
        )

    if path.stat().st_size == 0:
        return (
            f"{label} 파일이 비어 있음: "
            f"{path}"
        )

    return None


# ============================================================
# 오류 정보 추출
# ============================================================

def extract_error_info(
    result: dict[str, Any],
) -> tuple[str, str, str]:
    error = result.get(
        "error",
        {},
    )

    if not isinstance(
        error,
        dict,
    ):
        error = {}

    pipeline = result.get(
        "pipeline",
        {},
    )

    if not isinstance(
        pipeline,
        dict,
    ):
        pipeline = {}

    failed_stage = str(
        pipeline.get("failedStage")
        or error.get("stage")
        or result.get("stage")
        or ""
    )

    error_code = str(
        error.get(
            "code",
            "",
        )
    )

    error_message = str(
        error.get(
            "message",
            "",
        )
    )

    return (
        failed_stage,
        error_code,
        error_message,
    )


# ============================================================
# 테스트 한 건 실행
# ============================================================

def run_test_case(
    case: dict[str, str],
    *,
    output_dir: Path,
    allow_confirmation: bool,
    use_financial_api: bool,
    save_details: bool,
) -> dict[str, Any]:
    name = case["name"]

    input_path = (
        PROJECT_ROOT
        / case["file"]
    ).resolve()

    schema_path = (
        PROJECT_ROOT
        / case["schema"]
    ).resolve()

    preflight_errors = [
        error
        for error in (
            check_required_file(
                input_path,
                "샘플",
            ),
            check_required_file(
                schema_path,
                "스키마",
            ),
        )
        if error is not None
    ]

    # 샘플 또는 스키마가 없으면
    # API를 호출하지 않고 SKIP 처리한다.
    if preflight_errors:
        return {
            "testName": name,
            "status": "SKIP",
            "skipReason":
                " | ".join(
                    preflight_errors
                ),
            "filePath":
                str(input_path),
            "schemaPath":
                str(schema_path),
            "expectedDocumentType":
                case[
                    "expectedDocumentType"
                ],
            "expectedOrganizationKey":
                case[
                    "expectedOrganizationKey"
                ],
            "expectedSourceOrganization":
                case[
                    "expectedSourceOrganization"
                ],
        }

    started_at = time.perf_counter()

    try:
        result = analyze_document(
            input_path,
            allow_confirmation=(
                allow_confirmation
            ),
            use_financial_api=(
                use_financial_api
            ),
        )

    except KeyboardInterrupt:
        raise

    except Exception as error:
        result = {
            "success": False,
            "stage": "test_runner",
            "error": {
                "stage": "test_runner",
                "code": (
                    "UNEXPECTED_"
                    "TEST_RUNNER_ERROR"
                ),
                "message": str(error),
                "exceptionType":
                    type(error).__name__,
            },
        }

    measured_duration_ms = round(
        (
            time.perf_counter()
            - started_at
        )
        * 1000
    )

    pipeline = result.get(
        "pipeline",
        {},
    )

    if not isinstance(
        pipeline,
        dict,
    ):
        pipeline = {}

    validation = result.get(
        "validation",
        {},
    )

    if not isinstance(
        validation,
        dict,
    ):
        validation = {}

    schema_info = result.get(
        "schema",
        {},
    )

    if not isinstance(
        schema_info,
        dict,
    ):
        schema_info = {}

    actual_document_type = str(
        result.get(
            "documentType",
            "",
        )
    )

    actual_organization_key = str(
        result.get(
            "organizationKey",
            "",
        )
    )

    actual_source_organization = str(
        result.get(
            "sourceOrganization",
            "",
        )
    )

    expected_document_type = case[
        "expectedDocumentType"
    ]

    expected_organization_key = case[
        "expectedOrganizationKey"
    ]

    expected_source_organization = case[
        "expectedSourceOrganization"
    ]

    document_type_correct = (
        actual_document_type
        == expected_document_type
    )

    is_financial_case = (
        expected_document_type
        == "financial_inquiry_result"
    )

    if is_financial_case:
        organization_key_correct = (
            actual_organization_key
            == expected_organization_key
        )

        source_organization_correct = (
            actual_source_organization
            == expected_source_organization
        )

        organization_correct: (
            bool | None
        ) = (
            organization_key_correct
            and source_organization_correct
        )

    else:
        organization_key_correct = None
        source_organization_correct = None
        organization_correct = None

    pipeline_success = (
        bool(
            result.get(
                "success"
            )
        )
        and bool(
            pipeline.get(
                "success",
                result.get("success"),
            )
        )
    )

    validation_success = (
        validation.get(
            "success"
        )
        is True
    )

    schema_exists = (
        schema_info.get(
            "exists"
        )
        is True
    )

    passed = (
        pipeline_success
        and document_type_correct
        and validation_success
        and schema_exists
        and (
            organization_correct
            is not False
        )
    )

    (
        failed_stage,
        error_code,
        error_message,
    ) = extract_error_info(
        result
    )

    detail_output_path = (
        output_dir
        / "details"
        / f"{name}.json"
    )

    if save_details:
        save_json_file(
            detail_output_path,
            result,
        )

    return {
        "testName": name,
        "status":
            "PASS"
            if passed
            else "FAIL",
        "filePath":
            str(input_path),
        "schemaPath":
            str(schema_path),
        "detailOutputPath": (
            str(detail_output_path)
            if save_details
            else ""
        ),
        "expectedDocumentType":
            expected_document_type,
        "actualDocumentType":
            actual_document_type,
        "documentTypeCorrect":
            document_type_correct,
        "expectedOrganizationKey":
            expected_organization_key,
        "actualOrganizationKey":
            actual_organization_key,
        "organizationKeyCorrect":
            organization_key_correct,
        "expectedSourceOrganization":
            expected_source_organization,
        "actualSourceOrganization":
            actual_source_organization,
        "sourceOrganizationCorrect":
            source_organization_correct,
        "organizationCorrect":
            organization_correct,
        "pipelineSuccess":
            pipeline_success,
        "validationSuccess":
            validation_success,
        "schemaExists":
            schema_exists,
        "failedStage":
            failed_stage,
        "errorCode":
            error_code,
        "errorMessage":
            error_message,
        "durationMs": int(
            pipeline.get(
                "totalDurationMs",
                measured_duration_ms,
            )
        ),
    }


# ============================================================
# 전체 통계 생성
# ============================================================

def build_summary(
    results: list[dict[str, Any]],
) -> dict[str, Any]:
    executed = [
        result
        for result in results
        if result["status"] != "SKIP"
    ]

    skipped = [
        result
        for result in results
        if result["status"] == "SKIP"
    ]

    financial_executed = [
        result
        for result in executed
        if (
            result[
                "expectedDocumentType"
            ]
            == "financial_inquiry_result"
        )
    ]

    pass_count = sum(
        result["status"] == "PASS"
        for result in executed
    )

    fail_count = sum(
        result["status"] == "FAIL"
        for result in executed
    )

    pipeline_success_count = sum(
        result.get(
            "pipelineSuccess"
        )
        is True
        for result in executed
    )

    document_type_correct_count = sum(
        result.get(
            "documentTypeCorrect"
        )
        is True
        for result in executed
    )

    organization_correct_count = sum(
        result.get(
            "organizationCorrect"
        )
        is True
        for result in financial_executed
    )

    validation_success_count = sum(
        result.get(
            "validationSuccess"
        )
        is True
        for result in executed
    )

    total_duration_ms = sum(
        int(
            result.get(
                "durationMs",
                0,
            )
        )
        for result in executed
    )

    return {
        "generatedAt": (
            datetime.now()
            .astimezone()
            .isoformat(
                timespec="seconds"
            )
        ),
        "totalConfigured":
            len(results),
        "executedCount":
            len(executed),
        "skippedCount":
            len(skipped),
        "passCount":
            pass_count,
        "failCount":
            fail_count,
        "pipelineSuccessCount":
            pipeline_success_count,
        "documentTypeCorrectCount":
            document_type_correct_count,
        "financialExecutedCount":
            len(financial_executed),
        "organizationCorrectCount":
            organization_correct_count,
        "validationSuccessCount":
            validation_success_count,
        "pipelineSuccessRate":
            calculate_rate(
                pipeline_success_count,
                len(executed),
            ),
        "documentClassificationAccuracy":
            calculate_rate(
                document_type_correct_count,
                len(executed),
            ),
        "financialOrganizationAccuracy":
            calculate_rate(
                organization_correct_count,
                len(financial_executed),
            ),
        "schemaValidationPassRate":
            calculate_rate(
                validation_success_count,
                len(executed),
            ),
        "testPassRate":
            calculate_rate(
                pass_count,
                len(executed),
            ),
        "totalDurationMs":
            total_duration_ms,
        "results":
            results,
    }


# ============================================================
# 콘솔 출력
# ============================================================

def print_result(
    index: int,
    total: int,
    result: dict[str, Any],
) -> None:
    name = result["testName"]
    status = result["status"]

    if status == "SKIP":
        print(
            f"[{index}/{total}] "
            f"{name:<24} "
            f"SKIP - "
            f"{result['skipReason']}",
            flush=True,
        )
        return

    duration_seconds = (
        result.get("durationMs", 0)
        / 1000
    )

    message = (
        f"[{index}/{total}] "
        f"{name:<24} "
        f"{status} "
        f"({duration_seconds:.1f}s)"
    )

    if status == "FAIL":
        reasons: list[str] = []

        if not result.get(
            "pipelineSuccess"
        ):
            reasons.append(
                "pipeline="
                f"{result.get('failedStage') or 'failed'}"
            )

        if not result.get(
            "documentTypeCorrect"
        ):
            reasons.append(
                "documentType="
                f"{result.get('actualDocumentType') or 'unknown'}"
            )

        if (
            result.get(
                "organizationCorrect"
            )
            is False
        ):
            reasons.append(
                "organizationKey="
                f"{result.get('actualOrganizationKey') or 'unknown'}"
            )

        if not result.get(
            "validationSuccess"
        ):
            reasons.append(
                "validation=false"
            )

        if reasons:
            message += (
                " - "
                + ", ".join(reasons)
            )

    print(
        message,
        flush=True,
    )

def print_summary(
    summary: dict[str, Any],
    summary_path: Path,
) -> None:
    print(
        "\n========== 전체 테스트 결과 =========="
    )

    print(
        f"설정된 테스트: "
        f"{summary['totalConfigured']}개"
    )

    print(
        f"실행: "
        f"{summary['executedCount']}개"
    )

    print(
        f"건너뜀: "
        f"{summary['skippedCount']}개"
    )

    print(
        f"통과: "
        f"{summary['passCount']}개"
    )

    print(
        f"실패: "
        f"{summary['failCount']}개"
    )

    print(
        "파이프라인 성공률: "
        f"{format_rate(
            summary['pipelineSuccessRate']
        )}"
    )

    print(
        "문서 종류 분류 정확도: "
        f"{format_rate(
            summary[
                'documentClassificationAccuracy'
            ]
        )}"
    )

    print(
        "금융기관 분류 정확도: "
        f"{format_rate(
            summary[
                'financialOrganizationAccuracy'
            ]
        )}"
    )

    print(
        "스키마 검증 통과율: "
        f"{format_rate(
            summary[
                'schemaValidationPassRate'
            ]
        )}"
    )

    print(
        "전체 테스트 통과율: "
        f"{format_rate(
            summary['testPassRate']
        )}"
    )

    print(
        f"총 실행 시간: "
        f"{summary['totalDurationMs'] / 1000:.1f}초"
    )

    print(
        f"요약 저장 경로: "
        f"{summary_path}"
    )

    print(
        "======================================="
    )

    print(
        "주의: 위 수치는 파이프라인·분류·검증 "
        "지표이며, 세부 필드 정확도는 "
        "expected.json 비교가 추가로 필요합니다."
    )


# ============================================================
# 실행할 테스트 선택
# ============================================================

def select_cases(
    only_names: list[str] | None,
) -> list[dict[str, str]]:
    if not only_names:
        return TEST_CASES

    known_names = {
        case["name"]
        for case in TEST_CASES
    }

    unknown_names = sorted(
        set(only_names)
        - known_names
    )

    if unknown_names:
        raise ValueError(
            "알 수 없는 테스트 이름: "
            + ", ".join(
                unknown_names
            )
        )

    selected_names = set(
        only_names
    )

    return [
        case
        for case in TEST_CASES
        if case["name"]
        in selected_names
    ]


# ============================================================
# CLI
# ============================================================

def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "등록된 문서 샘플을 "
            "document_analysis_pipeline.py로 "
            "순차 실행하고 분류·검증·성공률을 "
            "계산합니다."
        )
    )

    parser.add_argument(
        "--only",
        nargs="+",
        help=(
            "특정 테스트만 실행합니다. 예: "
            "--only death_certificate "
            "death_report bank"
        ),
    )

    parser.add_argument(
        "--list",
        action="store_true",
        help=(
            "등록된 테스트 이름을 출력하고 "
            "종료합니다."
        ),
    )

    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=(
            "상세 결과와 요약 JSON을 "
            "저장할 폴더"
        ),
    )

    parser.add_argument(
        "--allow-confirmation",
        action="store_true",
        help=(
            "needsConfirmation=true인 분류도 "
            "다음 단계까지 실행합니다."
        ),
    )

    parser.add_argument(
        "--skip-financial-api",
        action="store_true",
        help=(
            "금융기관 API 분류를 생략하고 "
            "텍스트 fallback 규칙만 사용합니다."
        ),
    )

    parser.add_argument(
        "--stop-on-failure",
        action="store_true",
        help=(
            "첫 FAIL 발생 시 남은 테스트를 "
            "중단합니다."
        ),
    )

    parser.add_argument(
        "--no-save-details",
        action="store_true",
        help=(
            "각 문서의 전체 파이프라인 결과 "
            "JSON 저장을 생략합니다."
        ),
    )

    args = parser.parse_args()

    if args.list:
        for case in TEST_CASES:
            print(
                case["name"]
            )

        return 0

    try:
        selected_cases = select_cases(
            args.only
        )

    except ValueError as error:
        print(
            str(error),
            file=sys.stderr,
        )

        return 2

    output_dir = (
        args.output_dir
        .expanduser()
    )

    if not output_dir.is_absolute():
        output_dir = (
            PROJECT_ROOT
            / output_dir
        )

    output_dir = output_dir.resolve()

    results: list[
        dict[str, Any]
    ] = []

    total = len(
        selected_cases
    )

    print(
        f"총 {total}개 테스트를 시작합니다."
    )

    print(
        "금융 문서는 기관 분류 API 호출 때문에 "
        "시간이 더 오래 걸릴 수 있습니다.\n"
    )

    try:
        for index, case in enumerate(
            selected_cases,
            start=1,
        ):
            result = run_test_case(
                case,
                output_dir=output_dir,
                allow_confirmation=(
                    args.allow_confirmation
                ),
                use_financial_api=(
                    not args.skip_financial_api
                ),
                save_details=(
                    not args.no_save_details
                ),
            )

            results.append(
                result
            )

            print_result(
                index,
                total,
                result,
            )

            if (
                args.stop_on_failure
                and result["status"] == "FAIL"
            ):
                print(
                    "첫 실패가 발생해 "
                    "테스트를 중단합니다."
                )

                break

    except KeyboardInterrupt:
        print(
            "\n사용자 요청으로 테스트를 "
            "중단했습니다.",
            file=sys.stderr,
        )

    summary = build_summary(
        results
    )

    summary_path = (
        output_dir
        / "pipeline_test_summary.json"
    )

    save_json_file(
        summary_path,
        summary,
    )

    print_summary(
        summary,
        summary_path,
    )

    return (
        0
        if summary["failCount"] == 0
        else 1
    )


if __name__ == "__main__":
    raise SystemExit(
        main()
    )