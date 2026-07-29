import base64
import json
import mimetypes
import os
from pathlib import Path

import requests
from dotenv import load_dotenv


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

CATEGORY = "financial"
DOCUMENT = "forestry_cooperative"
DOCUMENT_TYPE = "forestry_cooperative_financial_result"

DOCUMENT_DIR = BASE_DIR / "document" / CATEGORY / DOCUMENT

DOCUMENT_PATH = DOCUMENT_DIR / "sample.png"
SCHEMA_PATH = DOCUMENT_DIR / "schema.json"
OUTPUT_PATH = DOCUMENT_DIR / "extract_result.json"

API_KEY = os.getenv("UPSTAGE_API_KEY")
URL = "https://api.upstage.ai/v1/information-extraction"


def encode_file_as_data_url(file_path: Path) -> str:
    """문서 파일을 Base64 Data URL 형태로 변환한다."""

    mime_type, _ = mimetypes.guess_type(file_path.name)

    if mime_type is None:
        mime_type = "application/octet-stream"

    encoded_file = base64.b64encode(
        file_path.read_bytes()
    ).decode("utf-8")

    return f"data:{mime_type};base64,{encoded_file}"


def load_response_format(schema_path: Path) -> dict:
    """스키마 파일을 읽고 response_format 형식으로 정리한다."""

    with schema_path.open("r", encoding="utf-8") as schema_file:
        schema_data = json.load(schema_file)

    # schema.json이 이미 Upstage response_format 전체 형식인 경우
    if (
        schema_data.get("type") == "json_schema"
        and "json_schema" in schema_data
    ):
        return schema_data

    # 순수 JSON Schema만 저장되어 있는 경우
    return {
        "type": "json_schema",
        "json_schema": {
            "name": f"{DOCUMENT_TYPE}_schema",
            "schema": schema_data
        }
    }


def main() -> None:
    if not API_KEY:
        print("❌ UPSTAGE_API_KEY를 불러오지 못했습니다.")
        return

    if not DOCUMENT_PATH.exists():
        print(f"❌ 문서 파일이 없습니다: {DOCUMENT_PATH}")
        return

    if not SCHEMA_PATH.exists():
        print(f"❌ 스키마 파일이 없습니다: {SCHEMA_PATH}")
        return

    try:
        document_data_url = encode_file_as_data_url(DOCUMENT_PATH)
        response_format = load_response_format(SCHEMA_PATH)

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

        print("상태 코드:", response.status_code)

        if not response.ok:
            print("❌ Information Extract 요청 실패")
            print(response.text)
            return

        api_result = response.json()

        content = api_result["choices"][0]["message"]["content"]
        extracted_data = json.loads(content)

        final_result = {
            "success": True,
            "documentType": DOCUMENT_TYPE,
            "data": extracted_data,
            "metadata": {
                "sourceFile": DOCUMENT_PATH.name,
                "model": "information-extract"
            }
        }

        with OUTPUT_PATH.open("w", encoding="utf-8") as output_file:
            json.dump(
                final_result,
                output_file,
                ensure_ascii=False,
                indent=2
            )

        print("✅ 정보 추출 성공")
        print(f"결과 저장 위치: {OUTPUT_PATH}")

        print("\n===== 추출된 정보 =====")
        print(
            json.dumps(
                extracted_data,
                ensure_ascii=False,
                indent=2
            )
        )

    except json.JSONDecodeError as error:
        print("❌ JSON 형식 처리 중 오류가 발생했습니다.")
        print(error)

    except KeyError as error:
        print("❌ 예상한 API 응답 구조와 다릅니다.")
        print("누락된 키:", error)

        if "response" in locals():
            print("전체 응답:", response.text)

    except requests.RequestException as error:
        print("❌ 네트워크 또는 API 요청 오류가 발생했습니다.")
        print(error)


if __name__ == "__main__":
    main()