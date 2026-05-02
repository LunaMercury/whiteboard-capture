# CSS 스타일링 지침 (CSS Rules)

프론트엔드 개발 시 다음의 스타일링 원칙을 반드시 준수합니다.

## 1. Tailwind CSS 사용 지양
*   **전통적 CSS 선호**: 유틸리티 클래스 위주의 Tailwind CSS 사용을 최소화하거나 금지합니다.
*   **순수 CSS/SCSS 모듈화**: React 컴포넌트별로 `*.module.css` (또는 `.scss`) 파일을 생성하여 스타일 격리를 달성합니다.

## 2. 클래스 네이밍 규칙
*   **의미론적 네이밍 (Semantic Naming)**: `text-red-500`과 같은 형태 대신, `error-message`, `submit-button` 등 요소의 목적과 의미를 담은 클래스명을 사용합니다.
*   **BEM 방법론 (선택적 권장)**: Block, Element, Modifier 구조를 활용하여 CSS의 구조를 체계적으로 관리합니다. (예: `dashboard__header`, `button--primary`)

## 3. 디자인 품질 (Premium Design)
*   단순하고 투박한 디자인을 피하고, 모던하고 역동적인 UI를 구성합니다.
*   **애니메이션**: 마이크로 인터랙션, 호버(Hover) 효과, 부드러운 화면 전환을 기본으로 적용합니다.
*   **트렌드**: Glassmorphism, 다크 모드 지원 등 시각적으로 우수한(Premium) 사용자 경험을 제공해야 합니다.
