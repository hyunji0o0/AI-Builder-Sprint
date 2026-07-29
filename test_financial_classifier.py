import base64
import json
import mimetypes
import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
FINANCIAL_DIR = BASE_DIR / "document" / "financial"
COMMON_SCHEMA_PATH = FINANCIAL_DIR / "common" / "schema.json"

API_KEY = os.getenv("UPSTAGE_API_KEY")
URL = "https://api.upstage.ai/v1/information-extraction"

TEST_CASES = {
    "bank": "은행연합회",
    "life_insurance": "생명보험협회",
    "nonlife_insurance": "손해보험협회",
    "financial_investment": "금융투자협회",
    "credit_finance": "여신금융협회",
    "korea_post": "우정사업본부",
    "saving_bank": "저축은행중앙회",
    "community_credit": "새마을금고중앙회",
    "forestry_cooperative": "산림조합중앙회",
    "credit_union": "신협중앙회",
    "korea_security": "한국예탁결제원",

    "deposit": "예금보험공사",
    "credit_information": "신용정보원"
}


def encode_file_as_data_url(file_path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(file_path.name)

    if mime_type is None:
        mime_type = "application/octet-stream"

    encoded_file = base64.b64encode(
        file_path.read_bytes()
    ).decode("utf-8")

    return f"data:{mime_type};base64,{encoded_file}"


def load_common_schema() -> dict:
    with COMMON_SCHEMA_PATH.open(
        "r",
        encoding="utf-8"
    ) as schema_file:
        return json.load(schema_file)


def classify_document(
    image_path: Path,
    response_format: dict
) -> dict:
    document_data_url = encode_file_as_data_url(image_path)

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    request_body = {
        "model": "information-extract",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": document_data_url
                        }
                    }
                ]
            }
        ],
        "response_format": response_format
    }

    response = requests.post(
        URL,
        headers=headers,
        json=request_body,
        timeout=180
    )

    if not response.ok:
        raise RuntimeError(
            f"상태 코드 {response.status_code}: "
            f"{response.text}"
        )

    api_result = response.json()
    content = api_result["choices"][0]["message"]["content"]

    return json.loads(content)


def contains_phone_number(evidence: list[str]) -> bool:
    phone_pattern = re.compile(
        r"\b0\d{1,2}-\d{3,4}-\d{4}\b"
    )

    return any(
        phone_pattern.search(item)
        for item in evidence
    )


def main() -> None:
    if not API_KEY:
        print("❌ UPSTAGE_API_KEY가 없습니다.")
        return

    if not COMMON_SCHEMA_PATH.exists():
        print(
            f"❌ 공통 스키마가 없습니다: "
            f"{COMMON_SCHEMA_PATH}"
        )
        return

    response_format = load_common_schema()

    results = []
    passed_count = 0
    tested_count = 0

    for expected_key, expected_organization in TEST_CASES.items():
        image_path = (
            FINANCIAL_DIR
            / expected_key
            / "sample.png"
        )

        if not image_path.exists():
            print(
                f"⏭️ 건너뜀: {expected_key} "
                f"- sample.png 없음"
            )
            continue

        tested_count += 1

        try:
            result = classify_document(
                image_path,
                response_format
            )

            actual_key = result.get(
                "organizationKey",
                ""
            )
            actual_organization = result.get(
                "sourceOrganization",
                ""
            )
            confidence = result.get(
                "confidence",
                0
            )
            evidence = result.get(
                "organizationEvidence",
                []
            )
            needs_confirmation = result.get(
                "needsConfirmation",
                True
            )

            key_correct = actual_key == expected_key
            organization_correct = (
                actual_organization
                == expected_organization
            )
            enough_evidence = len(evidence) >= 2
            no_phone_evidence = not contains_phone_number(
                evidence
            )
            confidence_ok = confidence >= 0.8
            confirmation_ok = not needs_confirmation

            passed = all([
                key_correct,
                organization_correct,
                enough_evidence,
                no_phone_evidence,
                confidence_ok,
                confirmation_ok
            ])

            if passed:
                passed_count += 1
                mark = "✅"
            else:
                mark = "❌"

            print(
                f"\n{mark} {expected_key}"
            )
            print(
                f"정답 기관: {expected_organization}"
            )
            print(
                f"판별 기관: {actual_organization}"
            )
            print(
                f"정답 키: {expected_key}"
            )
            print(
                f"판별 키: {actual_key}"
            )
            print(
                f"신뢰도: {confidence}"
            )
            print(
                f"확인 필요: {needs_confirmation}"
            )
            print(
                f"판별 근거: {evidence}"
            )

            if contains_phone_number(evidence):
                print(
                    "⚠️ 판별 근거에 전화번호가 포함됐습니다."
                )

            results.append({
                "image": str(
                    image_path.relative_to(BASE_DIR)
                ),
                "expectedOrganizationKey": expected_key,
                "actualOrganizationKey": actual_key,
                "expectedSourceOrganization":
                    expected_organization,
                "actualSourceOrganization":
                    actual_organization,
                "confidence": confidence,
                "needsConfirmation":
                    needs_confirmation,
                "evidence": evidence,
                "passed": passed
            })

        except Exception as error:
            print(
                f"\n❌ {expected_key} 테스트 실패"
            )
            print(error)

            results.append({
                "image": str(
                    image_path.relative_to(BASE_DIR)
                ),
                "expectedOrganizationKey": expected_key,
                "error": str(error),
                "passed": False
            })

    output_path = (
        FINANCIAL_DIR
        / "common"
        / "classifier_test_result.json"
    )

    with output_path.open(
        "w",
        encoding="utf-8"
    ) as output_file:
        json.dump(
            {
                "testedCount": tested_count,
                "passedCount": passed_count,
                "accuracy": (
                    passed_count / tested_count
                    if tested_count > 0
                    else 0
                ),
                "results": results
            },
            output_file,
            ensure_ascii=False,
            indent=2
        )

    print("\n==============================")
    print(f"테스트 문서 수: {tested_count}")
    print(f"통과 문서 수: {passed_count}")

    if tested_count > 0:
        accuracy = passed_count / tested_count
        print(f"정확도: {accuracy:.2%}")

    print(f"결과 저장: {output_path}")


if __name__ == "__main__":
    main()