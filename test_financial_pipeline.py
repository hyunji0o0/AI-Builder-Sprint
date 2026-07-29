from __future__ import annotations

import json
from pathlib import Path

from financial_document_pipeline import (
    analyze_financial_document,
)


PROJECT_ROOT = Path(__file__).resolve().parent
FINANCIAL_DIR = PROJECT_ROOT / "document" / "financial"

TEST_CASES = {
    "bank": {
        "organization": "은행연합회",
        "expected_key": "bank",
    },
    "life_insurance": {
        "organization": "생명보험협회",
        "expected_key": "life_insurance",
    },
    "nonlife_insurance": {
        "organization": "손해보험협회",
        "expected_key": "nonlife_insurance",
    },
    "financial_investment": {
        "organization": "금융투자협회",
        "expected_key": "financial_investment",
    },
    "credit_finance": {
        "organization": "여신금융협회",
        "expected_key": "credit_finance",
    },
    "korea_post": {
        "organization": "우정사업본부",
        "expected_key": "korea_post",
    },
    "saving_bank": {
        "organization": "저축은행중앙회",
        "expected_key": "savings_bank",
    },
    "community_credit": {
        "organization": "새마을금고중앙회",
        "expected_key": "community_credit",
    },
    "forestry_cooperative": {
        "organization": "산림조합중앙회",
        "expected_key": "forestry_cooperative",
    },
    "credit_union": {
        "organization": "신협중앙회",
        "expected_key": "credit_union",
    },
    "korea_security": {
        "organization": "한국예탁결제원",
        "expected_key": "securities_depository",
    },
    "deposit": {
        "organization": "예금보험공사",
        "expected_key": "deposit_insurance",
    },
    "credit_information": {
        "organization": "신용정보원",
        "expected_key": "credit_information",
    },
}


def main() -> None:
    results = []

    passed_count = 0
    failed_count = 0
    skipped_count = 0

    print("=" * 70)
    print("금융 문서 전체 파이프라인 테스트")
    print("=" * 70)

    for index, (
        folder_name,
        test_case,
    ) in enumerate(TEST_CASES.items(), start=1):
        image_path = (
            FINANCIAL_DIR
            / folder_name
            / "sample.png"
        )

        expected_organization = (
            test_case["organization"]
        )
        expected_key = (
            test_case["expected_key"]
        )

        print()
        print(
            f"[{index}/{len(TEST_CASES)}] "
            f"{folder_name}"
        )

        if not image_path.exists():
            skipped_count += 1

            print("  결과: 건너뜀 - sample.png 없음")

            results.append(
                {
                    "folderName": folder_name,
                    "status": "skipped",
                    "success": False,
                    "error": "FILE_NOT_FOUND",
                }
            )
            continue

        result = analyze_financial_document(
            image_path
        )

        actual_organization = result.get(
            "sourceOrganization",
            "",
        )

        actual_key = result.get(
            "organizationKey",
            "",
        )

        data = result.get("data", {})

        records = (
            data.get("records", [])
            if isinstance(data, dict)
            else []
        )

        record_count = (
            data.get("recordCount", 0)
            if isinstance(data, dict)
            else 0
        )

        pipeline_success = (
            result.get("success") is True
        )

        organization_matched = (
            actual_organization
            == expected_organization
        )

        key_matched = (
            actual_key == expected_key
        )

        record_count_matched = (
            isinstance(records, list)
            and record_count == len(records)
        )

        passed = (
            pipeline_success
            and organization_matched
            and key_matched
            and record_count_matched
        )

        if passed:
            passed_count += 1
            status = "passed"
            print("  결과: 성공")
        else:
            failed_count += 1
            status = "failed"
            print("  결과: 실패")

        print(
            f"  기관명: "
            f"{actual_organization}"
        )
        print(
            f"  표준 키: "
            f"{actual_key}"
        )
        print(
            f"  레코드 수: "
            f"{record_count}"
        )

        results.append(
            {
                "folderName": folder_name,
                "status": status,
                "passed": passed,
                "expectedOrganization": (
                    expected_organization
                ),
                "actualOrganization": (
                    actual_organization
                ),
                "organizationMatched": (
                    organization_matched
                ),
                "expectedKey": expected_key,
                "actualKey": actual_key,
                "keyMatched": key_matched,
                "recordCount": record_count,
                "recordsLength": len(records),
                "recordCountMatched": (
                    record_count_matched
                ),
                "result": result,
            }
        )

    executed_count = (
        passed_count + failed_count
    )

    accuracy = (
        passed_count / executed_count
        if executed_count
        else 0
    )

    output = {
        "summary": {
            "total": len(TEST_CASES),
            "executed": executed_count,
            "passed": passed_count,
            "failed": failed_count,
            "skipped": skipped_count,
            "accuracyPercent": round(
                accuracy * 100,
                2,
            ),
        },
        "results": results,
    }

    output_path = (
        FINANCIAL_DIR
        / "common"
        / "pipeline_test_result.json"
    )

    with output_path.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            output,
            file,
            ensure_ascii=False,
            indent=2,
        )

    print()
    print("=" * 70)
    print("전체 결과")
    print("=" * 70)
    print(f"성공: {passed_count}")
    print(f"실패: {failed_count}")
    print(f"건너뜀: {skipped_count}")
    print(
        f"정확도: {accuracy * 100:.2f}%"
    )
    print(f"결과 파일: {output_path}")


if __name__ == "__main__":
    main()