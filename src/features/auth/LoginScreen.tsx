import { GoogleIcon } from './GoogleIcon'

type Props = {
  onSignIn: () => void
  error: string | null
}

export function LoginScreen({ onSignIn, error }: Props) {
  return (
    <div className="da-page da-login-page">
      <div className="da-login-card da-glass">
        <img className="da-brand-logo" src="/aedohal-sigan-icon-3d.svg" alt=""/>
        <strong>애도할 시간</strong>
        <span>당신의 곁에서, 사후 행정을 함께 정리해요</span>
        <button className="da-google-btn" onClick={onSignIn}>
          <GoogleIcon/> Google로 계속하기
        </button>
        {error && <p className="da-login-error">{error}</p>}
        <small className="da-privacy">로그인 정보는 안전하게 보호돼요</small>
      </div>
    </div>
  )
}
