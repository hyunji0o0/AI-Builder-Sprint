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

from document_parser import parse_document


# ============================================================
# 프로젝트 및 API 설정
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent
DOCUMENT_DIR = PROJECT_ROOT / "document"

FINANCIAL_DIR = DOCUMENT_DIR / "financial"
FINANCIAL_COMMON_SCHEMA_PATH = (
    FINANCIAL_DIR
    / "common"
    / "schema.json"
)

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
# 금융기관 표준 정보
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

ORGANIZATION_NAME_MAP = {
    "bank": "은행연합회",
    "life_insurance": "생명보험협회",
    "nonlife_insurance": "손해보험협회",
    "financial_investment": "금융투자협회",
    "credit_finance": "여신금융협회",
    "korea_post": "우정사업본부",
    "savings_bank": "저축은행중앙회",
    "community_credit": "새마을금고중앙회",
    "forestry_cooperative": "산림조합중앙회",
    "credit_union": "신협중앙회",
    "securities_depository": "한국예탁결제원",
    "consumer_finance": "대부금융협회",
    "deposit_insurance": "예금보험공사",
    "credit_information": "신용정보원",
}


# ============================================================
# 대분류 규칙
# ============================================================

DOCUMENT_RULES: dict[str, dict[str, Any]] = {
    "death_certificate": {
        "resultCategory": "death_document",
        "strong": [
            "사망진단서",
            "시체검안서",
        ],
        "normal": [
            "직접사인",
            "사망의원인",
            "사망의종류",
            "의료기관명칭",
            "진단의사",
            "검안의사",
        ],
        "minimumScore": 5,
    },
    "death_report": {
        "resultCategory": "death_document",
        "strong": [
            "사망신고서",
        ],
        "normal": [
            "신고인",
            "사망일시",
            "사망장소",
            "등록기준지",
            "제출인",
            "사망자의성명",
        ],
        "minimumScore": 5,
    },
    "financial_inquiry_result": {
        "resultCategory": "financial",
        "strong": [
            "상속인금융거래조회",
            "상속인금융거래조회결과",
            "금융거래조회결과",
            "금융내역조회",
            "금융거래조회",
        ],
        "normal": [
            "금융기관",
            "금융거래종류",
            "거래내역",
            "예금",
            "대출",
            "보험",
            "채무",
            "조회결과",
            "접수번호",
        ],
        "minimumScore": 6,
    },
    "land_inquiry_result": {
        "resultCategory": "land",
        "strong": [
            "토지소유현황",
            "토지조회결과",
            "조상땅찾기",
            "개인별토지소유현황",
        ],
        "normal": [
            "소재지",
            "지번",
            "지목",
            "면적",
            "소유자",
            "토지",
        ],
        "minimumScore": 6,
    },
    "vehicle_inquiry_result": {
        "resultCategory": "vehicle",
        "strong": [
            "자동차소유정보",
            "자동차조회결과",
            "자동차등록원부",
            "차량소유현황",
        ],
        "normal": [
            "자동차등록번호",
            "차대번호",
            "차명",
            "차종",
            "최초등록일",
            "자동차",
        ],
        "minimumScore": 6,
    },
    "tax_inquiry_result": {
        "resultCategory": "tax",
        "strong": [
            "국세체납",
            "지방세체납",
            "세금조회결과",
            "체납내역",
            "납세증명",
        ],
        "normal": [
            "세목",
            "납부기한",
            "체납액",
            "과세기관",
            "고지세액",
            "국세",
            "지방세",
        ],
        "minimumScore": 6,
    },
}


# ============================================================
# 금융기관 Parse 텍스트 fallback 규칙
# ============================================================

FINANCIAL_ORGANIZATION_RULES: dict[
    str,
    dict[str, Any],
] = {
    "bank": {
        "strong": [
            "은행대표번호",
            "성명불일치",
        ],
        "normal": [
            "담당점포",
            "금융거래종류",
            "상환일",
        ],
    },
    "life_insurance": {
        "strong": [
            "미청구보험금",
            "휴면보험금",
            "진흥원출연일자",
        ],
        "normal": [
            "가산이자",
            "잔여연금",
            "보험금산출일자",
            "보험계약관계",
        ],
    },
    "nonlife_insurance": {
        "strong": [
            "보험가입내역",
            "보험기간",
        ],
        "normal": [
            "증권계좌번호",
            "보험계약상태",
            "피보험자",
            "수익자",
        ],
    },
    "financial_investment": {
        "strong": [
            "금융투자회사거래내역",
            "국내주식",
            "해외주식",
        ],
        "normal": [
            "예수금",
            "CMA",
            "평가금액",
            "종목명",
        ],
    },
    "credit_finance": {
        "strong": [
            "DCDS가입여부",
            "DCDS",
            "채무금액",
        ],
        "normal": [
            "거래회사명",
            "거래내역",
            "통지일",
            "담당자연락처",
        ],
    },
    "korea_post": {
        "strong": [
            "보험환급금대출금액",
            "보험계약자대출금액",
            "예금대출금액",
        ],
        "normal": [
            "펀드금액",
            "카드금액",
            "기타금액",
            "총금액",
        ],
    },
    "savings_bank": {
        "strong": [
            "저축은행",
            "저축은행금융거래",
        ],
        "normal": [
            "거래종류",
            "지점명",
            "비고",
        ],
    },
    "community_credit": {
        "strong": [
            "금고명",
            "예금관련",
            "대출관련",
            "보험관련",
        ],
        "normal": [
            "조사기준일",
            "의뢰인",
            "예금총잔액",
            "대출잔액",
        ],
    },
    "forestry_cooperative": {
        "strong": [
            "수신예금",
            "수신해지",
            "총지급수",
        ],
        "normal": [
            "보증건수",
            "보증금액",
            "잔액번호",
            "대출건수",
        ],
    },
    "credit_union": {
        "strong": [
            "신협인가번호",
            "계좌별대출거래현황",
            "예금및출자금",
        ],
        "normal": [
            "신협명",
            "인가번호",
            "대출만기일",
            "우편번호",
        ],
    },
    "securities_depository": {
        "strong": [
            "상속인증권거래조회",
            "종합위탁계좌",
            "수량또는잔액",
        ],
        "normal": [
            "상품구분",
            "평가금액",
            "국내주식",
            "예수금",
        ],
    },
    "consumer_finance": {
        "strong": [
            "대부금융",
            "대부업체",
            "대부계약",
        ],
        "normal": [
            "대부금액",
            "대출잔액",
            "등록대부업체",
            "채무내역",
        ],
    },
    "deposit_insurance": {
        "strong": [
            "상속인미수령금",
            "상속인채무정보",
            "예금보험금",
            "파산배당금",
        ],
        "normal": [
            "파산금융회사",
            "채권양도기관",
            "원금잔액",
            "소각여부",
        ],
    },
    "credit_information": {
        "strong": [
            "사망자의금융거래회사",
            "금융거래회사를조회중",
        ],
        "normal": [
            "금융기관",
            "금융거래종류",
            "담당점포",
            "대표번호",
        ],
    },
}


# ============================================================
# 오류 클래스
# ============================================================

class ClassificationError(Exception):
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
        "stage": "document_classification",
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
# 공통 유틸리티
# ============================================================

def normalize_text(
    value: Any,
) -> str:
    if value is None:
        return ""

    text = str(value)

    text = text.replace(
        "\u00a0",
        " ",
    )

    text = re.sub(
        r"\s+",
        " ",
        text,
    )

    return text.strip()


def compact_text(
    value: Any,
) -> str:
    text = normalize_text(value)

    # 공백과 일반적인 문장부호를 제거해
    # OCR 띄어쓰기 차이에 덜 민감하게 만든다.
    text = re.sub(
        r"[\s·ㆍ,.:;(){}\[\]/\\|<>'\"_-]+",
        "",
        text,
    )

    return text.lower()


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

    return round(
        min(
            max(confidence, 0.0),
            1.0,
        ),
        4,
    )


def normalize_boolean(
    value: Any,
) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.strip().lower() in {
            "true",
            "1",
            "yes",
            "y",
        }

    return bool(value)


def load_json_file(
    file_path: Path,
) -> dict[str, Any]:
    if not file_path.exists():
        raise ClassificationError(
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
            result = json.load(file)

    except json.JSONDecodeError as error:
        raise ClassificationError(
            code="INVALID_SCHEMA",
            message=(
                "분류 스키마 JSON 형식이 "
                "올바르지 않습니다."
            ),
            details={
                "schemaPath": str(file_path),
                "reason": str(error),
            },
        ) from error

    if not isinstance(result, dict):
        raise ClassificationError(
            code="INVALID_SCHEMA",
            message=(
                "분류 스키마의 최상위 값은 "
                "객체여야 합니다."
            ),
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


def get_mime_type(
    file_path: Path,
) -> str:
    fixed_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }

    extension = file_path.suffix.lower()

    if extension in fixed_types:
        return fixed_types[extension]

    guessed_type, _ = mimetypes.guess_type(
        str(file_path)
    )

    return guessed_type or "application/octet-stream"


def file_to_data_url(
    file_path: Path,
) -> str:
    try:
        with file_path.open(
            "rb"
        ) as file:
            encoded = base64.b64encode(
                file.read()
            ).decode("utf-8")

    except OSError as error:
        raise ClassificationError(
            code="FILE_READ_ERROR",
            message="분류할 파일을 읽지 못했습니다.",
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
        f"base64,{encoded}"
    )


# ============================================================
# Document Parse 결과에서 텍스트 꺼내기
# ============================================================

def get_classification_text(
    parse_result: dict[str, Any],
) -> str:
    if not isinstance(parse_result, dict):
        return ""

    # 최신 document_parser.py 형식
    parse_data = parse_result.get(
        "parse",
        {},
    )

    if not isinstance(parse_data, dict):
        parse_data = {}

    classification_text = parse_data.get(
        "classificationText",
        "",
    )

    if isinstance(
        classification_text,
        str,
    ) and classification_text.strip():
        return normalize_text(
            classification_text
        )

    # 혹시 최상위에 있는 경우도 지원
    classification_text = parse_result.get(
        "classificationText",
        "",
    )

    if isinstance(
        classification_text,
        str,
    ) and classification_text.strip():
        return normalize_text(
            classification_text
        )

    content = parse_data.get(
        "content",
        {},
    )

    if not isinstance(content, dict):
        return ""

    plain_text = content.get(
        "text",
        "",
    )

    if isinstance(
        plain_text,
        str,
    ) and plain_text.strip():
        return normalize_text(
            plain_text
        )

    markdown_text = content.get(
        "markdown",
        "",
    )

    if isinstance(
        markdown_text,
        str,
    ) and markdown_text.strip():
        cleaned = re.sub(
            r"[#*_`>|~]+",
            " ",
            markdown_text,
        )

        return normalize_text(cleaned)

    html_text = content.get(
        "html",
        "",
    )

    if isinstance(
        html_text,
        str,
    ) and html_text.strip():
        cleaned = re.sub(
            r"<[^>]+>",
            " ",
            html_text,
        )

        return normalize_text(cleaned)

    return ""


# ============================================================
# Parse 텍스트 기반 문서 대분류
# ============================================================

def calculate_rule_score(
    text: str,
    strong_keywords: list[str],
    normal_keywords: list[str],
) -> tuple[int, list[str]]:
    normalized = compact_text(text)

    score = 0
    evidence: list[str] = []

    for keyword in strong_keywords:
        keyword_compact = compact_text(
            keyword
        )

        if (
            keyword_compact
            and keyword_compact in normalized
        ):
            score += 5
            evidence.append(keyword)

    for keyword in normal_keywords:
        keyword_compact = compact_text(
            keyword
        )

        if (
            keyword_compact
            and keyword_compact in normalized
        ):
            score += 2
            evidence.append(keyword)

    return score, list(
        dict.fromkeys(evidence)
    )


def score_to_confidence(
    best_score: int,
    second_score: int,
    strong_match_count: int,
) -> float:
    if best_score <= 0:
        return 0.0

    score_part = min(
        best_score / 14,
        1.0,
    )

    score_gap = max(
        best_score - second_score,
        0,
    )

    gap_part = min(
        score_gap / 8,
        1.0,
    )

    confidence = (
        0.45
        + score_part * 0.35
        + gap_part * 0.15
    )

    if strong_match_count > 0:
        confidence += 0.05

    return normalize_confidence(
        min(confidence, 0.99)
    )


def classify_top_level_document(
    parsed_text: str,
) -> dict[str, Any]:
    if not parsed_text.strip():
        return {
            "documentType": "unknown",
            "resultCategory": "unknown",
            "confidence": 0.0,
            "needsConfirmation": True,
            "evidence": [],
            "scores": {},
            "method": "document_parse_rules",
        }

    scored_results: list[
        dict[str, Any]
    ] = []

    score_map: dict[str, int] = {}

    for (
        document_type,
        rules,
    ) in DOCUMENT_RULES.items():
        score, evidence = calculate_rule_score(
            text=parsed_text,
            strong_keywords=rules[
                "strong"
            ],
            normal_keywords=rules[
                "normal"
            ],
        )

        strong_count = sum(
            1
            for keyword in rules["strong"]
            if compact_text(keyword)
            in compact_text(parsed_text)
        )

        score_map[document_type] = score

        scored_results.append(
            {
                "documentType": document_type,
                "resultCategory": rules[
                    "resultCategory"
                ],
                "score": score,
                "strongMatchCount":
                    strong_count,
                "minimumScore": rules[
                    "minimumScore"
                ],
                "evidence": evidence,
            }
        )

    scored_results.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    best = scored_results[0]

    second_score = (
        scored_results[1]["score"]
        if len(scored_results) > 1
        else 0
    )

    # 제목이 생략된 금융 결과도 기관 고유 항목이
    # 충분하면 금융 문서로 판단할 수 있도록 보완한다.
    fallback_organization = (
        classify_financial_by_rules(
            parsed_text
        )
    )

    if (
        best["score"]
        < best["minimumScore"]
        and fallback_organization[
            "organizationScore"
        ] >= 7
    ):
        best = {
            "documentType":
                "financial_inquiry_result",
            "resultCategory": "financial",
            "score": fallback_organization[
                "organizationScore"
            ],
            "strongMatchCount": 1,
            "minimumScore": 6,
            "evidence":
                fallback_organization[
                    "organizationEvidence"
                ],
        }

        second_score = 0

    if best["score"] < best["minimumScore"]:
        return {
            "documentType": "unknown",
            "resultCategory": "unknown",
            "confidence": 0.0,
            "needsConfirmation": True,
            "evidence": best["evidence"],
            "scores": score_map,
            "method": "document_parse_rules",
        }

    confidence = score_to_confidence(
        best_score=best["score"],
        second_score=second_score,
        strong_match_count=best[
            "strongMatchCount"
        ],
    )

    needs_confirmation = (
        confidence < 0.75
        or (
            best["score"]
            - second_score
        ) < 2
    )

    return {
        "documentType": best[
            "documentType"
        ],
        "resultCategory": best[
            "resultCategory"
        ],
        "confidence": confidence,
        "needsConfirmation":
            needs_confirmation,
        "evidence": best["evidence"],
        "scores": score_map,
        "method": "document_parse_rules",
    }


# ============================================================
# Parse 텍스트 기반 금융기관 fallback 분류
# ============================================================

def classify_financial_by_rules(
    parsed_text: str,
) -> dict[str, Any]:
    scored_results: list[
        dict[str, Any]
    ] = []

    score_map: dict[str, int] = {}

    for (
        organization_key,
        rules,
    ) in FINANCIAL_ORGANIZATION_RULES.items():
        score, evidence = calculate_rule_score(
            text=parsed_text,
            strong_keywords=rules[
                "strong"
            ],
            normal_keywords=rules[
                "normal"
            ],
        )

        score_map[organization_key] = score

        scored_results.append(
            {
                "organizationKey":
                    organization_key,
                "score": score,
                "evidence": evidence,
            }
        )

    scored_results.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    best = scored_results[0]

    second_score = (
        scored_results[1]["score"]
        if len(scored_results) > 1
        else 0
    )

    if best["score"] < 5:
        return {
            "sourceOrganization": "unknown",
            "organizationKey": "unknown",
            "organizationEvidence": (
                best["evidence"]
            ),
            "organizationConfidence": 0.0,
            "organizationNeedsConfirmation":
                True,
            "organizationScore":
                best["score"],
            "scores": score_map,
            "method":
                "document_parse_fallback_rules",
        }

    confidence = score_to_confidence(
        best_score=best["score"],
        second_score=second_score,
        strong_match_count=1,
    )

    needs_confirmation = (
        confidence < 0.75
        or (
            best["score"]
            - second_score
        ) < 2
    )

    return {
        "sourceOrganization":
            ORGANIZATION_NAME_MAP.get(
                best["organizationKey"],
                "unknown",
            ),
        "organizationKey":
            best["organizationKey"],
        "organizationEvidence":
            best["evidence"],
        "organizationConfidence":
            confidence,
        "organizationNeedsConfirmation":
            needs_confirmation,
        "organizationScore":
            best["score"],
        "scores": score_map,
        "method":
            "document_parse_fallback_rules",
    }


# ============================================================
# Information Extract 금융기관 분류
# ============================================================

def remove_markdown_code_block(
    value: str,
) -> str:
    text = value.strip()

    if not text.startswith("```"):
        return text

    lines = text.splitlines()

    if lines:
        lines = lines[1:]

    if (
        lines
        and lines[-1].strip() == "```"
    ):
        lines = lines[:-1]

    return "\n".join(lines).strip()


def parse_json_text(
    value: str,
) -> dict[str, Any]:
    cleaned = remove_markdown_code_block(
        value
    )

    try:
        result = json.loads(cleaned)

    except json.JSONDecodeError:
        start_index = cleaned.find("{")
        end_index = cleaned.rfind("}")

        if (
            start_index == -1
            or end_index == -1
        ):
            raise ClassificationError(
                code="INVALID_CLASSIFICATION_RESULT",
                message=(
                    "기관 분류 응답에서 JSON 객체를 "
                    "찾지 못했습니다."
                ),
            )

        try:
            result = json.loads(
                cleaned[
                    start_index:
                    end_index + 1
                ]
            )

        except json.JSONDecodeError as error:
            raise ClassificationError(
                code="INVALID_CLASSIFICATION_RESULT",
                message=(
                    "기관 분류 결과가 올바른 "
                    "JSON 형식이 아닙니다."
                ),
                details={
                    "reason": str(error),
                    "responsePreview":
                        cleaned[:1000],
                },
            ) from error

    if not isinstance(result, dict):
        raise ClassificationError(
            code="INVALID_CLASSIFICATION_RESULT",
            message=(
                "기관 분류 결과의 최상위 값은 "
                "객체여야 합니다."
            ),
        )

    return result


def extract_content_from_response(
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
        raise ClassificationError(
            code="INVALID_CLASSIFICATION_RESULT",
            message=(
                "기관 분류 API 응답에 "
                "choices[0].message.content가 없습니다."
            ),
        ) from error

    if isinstance(content, dict):
        return content

    if isinstance(content, str):
        return parse_json_text(
            content
        )

    if isinstance(content, list):
        text_parts: list[str] = []

        for item in content:
            if isinstance(item, str):
                text_parts.append(item)

            elif isinstance(item, dict):
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

        if text_parts:
            return parse_json_text(
                "\n".join(text_parts)
            )

    raise ClassificationError(
        code="INVALID_CLASSIFICATION_RESULT",
        message=(
            "기관 분류 API 응답을 JSON 객체로 "
            "변환하지 못했습니다."
        ),
    )


def request_financial_classification(
    file_path: Path,
    max_retries: int = 2,
) -> dict[str, Any]:
    load_dotenv(
        PROJECT_ROOT / ".env",
        override=False,
    )

    api_key = os.getenv(
        "UPSTAGE_API_KEY",
        "",
    ).strip()

    if not api_key:
        raise ClassificationError(
            code="API_KEY_NOT_FOUND",
            message=(
                ".env 파일에 UPSTAGE_API_KEY가 "
                "설정되어 있지 않습니다."
            ),
        )

    schema_document = load_json_file(
        FINANCIAL_COMMON_SCHEMA_PATH
    )

    data_url = file_to_data_url(
        file_path
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

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
        "response_format": schema_document,
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

            if response.ok:
                try:
                    response_body = (
                        response.json()
                    )

                except ValueError as error:
                    raise ClassificationError(
                        code=(
                            "INVALID_CLASSIFICATION_RESULT"
                        ),
                        message=(
                            "기관 분류 API 응답이 "
                            "JSON 형식이 아닙니다."
                        ),
                        details={
                            "responseBody":
                                response.text[:2000],
                        },
                    ) from error

                return extract_content_from_response(
                    response_body
                )

            if (
                response.status_code
                in RETRYABLE_STATUS_CODES
                and attempt < max_retries
            ):
                time.sleep(
                    2 ** attempt
                )
                continue

            raise ClassificationError(
                code=(
                    "FINANCIAL_CLASSIFICATION_API_ERROR"
                ),
                message=(
                    "금융기관 분류 API가 오류 응답을 "
                    "반환했습니다."
                ),
                details={
                    "statusCode":
                        response.status_code,
                    "responseBody":
                        response.text[:2000],
                },
            )

        except ClassificationError:
            raise

        except requests.Timeout as error:
            if attempt < max_retries:
                time.sleep(
                    2 ** attempt
                )
                continue

            raise ClassificationError(
                code=(
                    "FINANCIAL_CLASSIFICATION_TIMEOUT"
                ),
                message=(
                    "금융기관 분류 API 요청 시간이 "
                    "초과되었습니다."
                ),
            ) from error

        except requests.RequestException as error:
            if attempt < max_retries:
                time.sleep(
                    2 ** attempt
                )
                continue

            raise ClassificationError(
                code=(
                    "FINANCIAL_CLASSIFICATION_NETWORK_ERROR"
                ),
                message=(
                    "금융기관 분류 API에 "
                    "연결하지 못했습니다."
                ),
                details={
                    "reason": str(error),
                },
            ) from error

    raise ClassificationError(
        code="FINANCIAL_CLASSIFICATION_API_ERROR",
        message="금융기관 분류 요청에 실패했습니다.",
    )


def normalize_financial_classification(
    raw_result: dict[str, Any],
) -> dict[str, Any]:
    evidence = raw_result.get(
        "organizationEvidence",
        [],
    )

    if isinstance(evidence, str):
        evidence = (
            [evidence]
            if evidence.strip()
            else []
        )

    if not isinstance(evidence, list):
        evidence = []

    normalized_evidence = [
        normalize_text(item)
        for item in evidence
        if normalize_text(item)
    ]

    organization_key = normalize_text(
        raw_result.get(
            "organizationKey",
            "",
        )
    ).lower()

    source_organization = normalize_text(
        raw_result.get(
            "sourceOrganization",
            "",
        )
    )

    if (
        organization_key
        not in ORGANIZATION_FOLDER_MAP
    ):
        organization_key = "unknown"

    if (
        organization_key != "unknown"
        and not source_organization
    ):
        source_organization = (
            ORGANIZATION_NAME_MAP.get(
                organization_key,
                "",
            )
        )

    confidence = normalize_confidence(
        raw_result.get(
            "confidence",
            0,
        )
    )

    needs_confirmation = normalize_boolean(
        raw_result.get(
            "needsConfirmation",
            False,
        )
    )

    if (
        organization_key == "unknown"
        or confidence < 0.8
    ):
        needs_confirmation = True

    return {
        "sourceOrganization": (
            source_organization
            or "unknown"
        ),
        "organizationKey":
            organization_key,
        "organizationEvidence":
            normalized_evidence,
        "organizationConfidence":
            confidence,
        "organizationNeedsConfirmation":
            needs_confirmation,
        "organizationMessage":
            normalize_text(
                raw_result.get(
                    "classificationMessage",
                    "",
                )
            ),
        "method":
            "information_extract_schema",
    }


# ============================================================
# 스키마 경로 결정
# ============================================================

def resolve_schema_path(
    document_type: str,
    organization_key: str = "",
) -> Path | None:
    if document_type == "death_certificate":
        return (
            DOCUMENT_DIR
            / "death_certificate"
            / "schema.json"
        )

    if document_type == "death_report":
        return (
            DOCUMENT_DIR
            / "death_report"
            / "schema.json"
        )

    if (
        document_type
        == "financial_inquiry_result"
    ):
        folder_name = (
            ORGANIZATION_FOLDER_MAP.get(
                organization_key
            )
        )

        if not folder_name:
            return None

        return (
            FINANCIAL_DIR
            / folder_name
            / "schema.json"
        )

    # 토지·자동차·세금 폴더가 추가되면
    # 아래와 같은 규칙으로 자동 연결된다.
    possible_path = (
        DOCUMENT_DIR
        / document_type
        / "schema.json"
    )

    if possible_path.exists():
        return possible_path

    return None


# ============================================================
# 최종 문서 분류
# ============================================================

def classify_document(
    file_path: str | Path,
    parse_result: dict[str, Any] | None = None,
    use_financial_api: bool = True,
) -> dict[str, Any]:
    try:
        input_path = (
            Path(file_path)
            .expanduser()
            .resolve()
        )

        if not input_path.exists():
            raise ClassificationError(
                code="FILE_NOT_FOUND",
                message=(
                    f"파일을 찾지 못했습니다: "
                    f"{input_path}"
                ),
            )

        if not input_path.is_file():
            raise ClassificationError(
                code="INVALID_FILE_PATH",
                message=(
                    "입력 경로가 파일이 아닙니다."
                ),
            )

        if (
            input_path.suffix.lower()
            not in SUPPORTED_EXTENSIONS
        ):
            raise ClassificationError(
                code="UNSUPPORTED_FILE_TYPE",
                message=(
                    "지원하지 않는 파일 형식입니다: "
                    f"{input_path.suffix.lower()}"
                ),
            )

        if parse_result is None:
            parse_result = parse_document(
                input_path
            )

        if not parse_result.get(
            "success"
        ):
            return {
                "success": False,
                "error": {
                    "stage": "document_parse",
                    "code": (
                        parse_result
                        .get("error", {})
                        .get(
                            "code",
                            "DOCUMENT_PARSE_FAILED",
                        )
                    ),
                    "message": (
                        parse_result
                        .get("error", {})
                        .get(
                            "message",
                            "Document Parse에 실패했습니다.",
                        )
                    ),
                    "details": (
                        parse_result
                        .get("error", {})
                        .get(
                            "details",
                            {},
                        )
                    ),
                },
            }

        parsed_text = get_classification_text(
            parse_result
        )

        if not parsed_text:
            raise ClassificationError(
                code="EMPTY_PARSE_RESULT",
                message=(
                    "Document Parse 결과에서 "
                    "분류할 텍스트를 찾지 못했습니다."
                ),
            )

        top_level = (
            classify_top_level_document(
                parsed_text
            )
        )

        document_type = top_level[
            "documentType"
        ]

        result_category = top_level[
            "resultCategory"
        ]

        source_organization = ""
        organization_key = ""
        organization_classification: (
            dict[str, Any] | None
        ) = None

        warnings: list[str] = []

        # 금융 문서이면 기관 세부 분류
        if (
            document_type
            == "financial_inquiry_result"
        ):
            if use_financial_api:
                try:
                    raw_financial_result = (
                        request_financial_classification(
                            input_path
                        )
                    )

                    organization_classification = (
                        normalize_financial_classification(
                            raw_financial_result
                        )
                    )

                except ClassificationError as error:
                    warnings.append(
                        (
                            "Information Extract 기관 "
                            "분류에 실패해 Parse 텍스트 "
                            "규칙으로 대체했습니다: "
                            f"{error.message}"
                        )
                    )

            if organization_classification is None:
                organization_classification = (
                    classify_financial_by_rules(
                        parsed_text
                    )
                )

            organization_key = (
                organization_classification[
                    "organizationKey"
                ]
            )

            source_organization = (
                organization_classification[
                    "sourceOrganization"
                ]
            )

        schema_path = resolve_schema_path(
            document_type=document_type,
            organization_key=organization_key,
        )

        schema_exists = bool(
            schema_path
            and schema_path.exists()
        )

        organization_confidence = 0.0
        organization_needs_confirmation = False

        if organization_classification:
            organization_confidence = (
                normalize_confidence(
                    organization_classification.get(
                        "organizationConfidence",
                        0.0,
                    )
                )
            )

            organization_needs_confirmation = (
                normalize_boolean(
                    organization_classification.get(
                        "organizationNeedsConfirmation",
                        False,
                    )
                )
            )

        # 대분류 신뢰도가 조금 낮더라도 금융기관 세부 분류가
        # 충분히 신뢰할 수 있고 실제 스키마까지 연결되면,
        # 두 분류 결과가 서로 보완한다고 보고 자동 진행한다.
        financial_subtype_resolved = (
            document_type
            == "financial_inquiry_result"
            and organization_key
            not in {
                "",
                "unknown",
            }
            and schema_exists
            and organization_confidence >= 0.8
            and not organization_needs_confirmation
        )

        overall_needs_confirmation = (
            top_level[
                "needsConfirmation"
            ]
        )

        if financial_subtype_resolved:
            if overall_needs_confirmation:
                warnings.append(
                    (
                        "문서 대분류 신뢰도는 기준보다 "
                        "낮았지만 금융기관 세부 분류와 "
                        "스키마 연결이 확인되어 자동으로 "
                        "정보 추출을 진행합니다."
                    )
                )

            overall_needs_confirmation = False

        elif organization_classification:
            overall_needs_confirmation = (
                overall_needs_confirmation
                or organization_needs_confirmation
            )

        if document_type == "unknown":
            overall_needs_confirmation = True

        if (
            document_type
            == "financial_inquiry_result"
            and organization_key
            in {
                "",
                "unknown",
            }
        ):
            overall_needs_confirmation = True

        return {
            "success": True,
            "fileName": input_path.name,
            "filePath": str(input_path),
            "documentType": document_type,
            "resultCategory": result_category,
            "sourceOrganization":
                source_organization,
            "organizationKey":
                organization_key,
            "schemaPath": (
                str(schema_path)
                if schema_path
                else ""
            ),
            "schemaExists": schema_exists,
            "classification": {
                "confidence": top_level[
                    "confidence"
                ],
                "needsConfirmation":
                    overall_needs_confirmation,
                "evidence": top_level[
                    "evidence"
                ],
                "method": top_level[
                    "method"
                ],
                "scores": top_level[
                    "scores"
                ],
                "organization":
                    organization_classification,
            },
            "parse": {
                "success": True,
                "pageCount": (
                    parse_result
                    .get("parse", {})
                    .get("pageCount", 0)
                ),
                "elementCount": (
                    parse_result
                    .get("parse", {})
                    .get("elementCount")
                    or len(
                        parse_result
                        .get("parse", {})
                        .get(
                            "elements",
                            [],
                        )
                    )
                ),
            },
            "warnings": warnings,
        }

    except ClassificationError as error:
        return make_error_response(
            code=error.code,
            message=error.message,
            details=error.details,
        )

    except Exception as error:
        return make_error_response(
            code=(
                "UNEXPECTED_CLASSIFICATION_ERROR"
            ),
            message=(
                "문서 분류 중 예상하지 못한 "
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
            "Document Parse 결과를 이용해 "
            "문서 종류를 자동 분류합니다."
        )
    )

    parser.add_argument(
        "file",
        type=Path,
        help="분류할 이미지 또는 PDF 파일",
    )

    parser.add_argument(
        "--output",
        type=Path,
        help="분류 결과 JSON 저장 경로",
    )

    parser.add_argument(
        "--skip-financial-api",
        action="store_true",
        help=(
            "금융기관 Information Extract 분류를 "
            "생략하고 Parse 텍스트 규칙만 사용"
        ),
    )

    args = parser.parse_args()

    result = classify_document(
        file_path=args.file,
        use_financial_api=(
            not args.skip_financial_api
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
            f"\n분류 결과 저장 완료: "
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