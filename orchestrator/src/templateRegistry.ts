export type TemplateCategory = "auth" | "design" | "redis" | "realtime";
export type TemplateRole = "frontend" | "rust" | "java" | "mobile";

export type TemplateContextFlags = {
  webOnly: boolean;
  mobileRequested: boolean;
  serviceWide: boolean;
  hotPathRedis: boolean;
};

type CategoryTemplate = {
  notes: {
    default: string;
    variants?: Record<string, string>;
  };
  roleContracts: Partial<Record<TemplateRole, string[]>>;
  verifierChecks: string[];
};

export const categoryTemplateRegistry: Record<TemplateCategory, CategoryTemplate> = {
  auth: {
    notes: {
      default: "auth/JWT 작업에는 backend-core 구현과 backend-fast 리뷰가 기본으로 포함됩니다.",
      variants: {
        webOnly: "웹 전용 인증 요청이면 모바일은 제외할 수 있습니다.",
        nonWebOnly: "사용자 대상 로그인 제공자 추가 작업은 모바일도 최소 리뷰 이상 참여합니다.",
      },
    },
    roleContracts: {
      frontend: [
        "로그인 버튼, OAuth redirect, JWT 저장 방식은 백엔드와 합의된 계약만 사용합니다.",
      ],
      rust: [
        "JWT_SECRET_KEY, claim 구조, 만료 정책이 Spring 발급 토큰과 일치해야 합니다.",
      ],
      java: [
        "OAuth provider 연동, 사용자 식별, JWT 발급 구조를 전체 클라이언트와 일치시킵니다.",
      ],
      mobile: [
        "모바일 로그인 진입점이 추가되면 JWT 저장/복원과 업로드 인증 흐름이 기존 계약을 유지해야 합니다.",
      ],
    },
    verifierChecks: [
      "JWT_SECRET_KEY, claim 구조, 만료 정책 동기화 여부 확인",
      "OAuth redirect URI와 토큰 전달 방식 합의 여부 확인",
    ],
  },
  design: {
    notes: {
      default: "디자인/UI 변경은 기본적으로 웹 프론트엔드 중심으로 진행합니다.",
      variants: {
        mobileRequested: "모바일 범위가 명시된 디자인 변경은 모바일도 함께 구현합니다.",
      },
    },
    roleContracts: {
      frontend: [
        "기존 디자인 시스템과 화면 흐름을 불필요하게 깨지 않습니다.",
      ],
      mobile: [
        "모바일 UI를 바꾸는 경우 기존 촬영-업로드 흐름의 속도와 단순함을 유지합니다.",
      ],
    },
    verifierChecks: [
      "UI 변경 범위가 웹 전용인지 모바일 포함인지 확인",
      "기존 상태 관리/라우팅과 충돌 없는지 확인",
    ],
  },
  redis: {
    notes: {
      default: "Redis/캐시/세션 저장소 작업은 backend-core 구현을 기본으로 하고, backend-fast 영향 여부를 함께 검토합니다.",
      variants: {
        hotPath: "Redis/캐시 요청이 업로드 hot path 또는 websocket fan-out과 연결되어 있으므로 backend-fast도 직접 구현에 참여합니다.",
      },
    },
    roleContracts: {
      rust: [
        "hot path에 Redis를 붙일 경우 캐시 미스 fallback과 일관성 정책을 반드시 정의합니다.",
      ],
      java: [
        "세션/일반 캐시 도입 시 application.properties, .env, 로컬 실행 규칙과 충돌하지 않도록 구성합니다.",
      ],
    },
    verifierChecks: [
      "Redis 연결 정보(.env/application.properties) 누락 여부 확인",
      "캐시 미스 fallback 및 장애 시 동작 보장 여부 확인",
    ],
  },
  realtime: {
    notes: {
      default: "실시간/WebSocket 작업은 backend-fast 구현과 웹 프론트엔드 구현이 기본이며, backend-core는 인증/계약 관점에서 최소 리뷰가 필요합니다.",
    },
    roleContracts: {
      frontend: [
        "WebSocket 메시지 포맷과 연결 상태 UI는 backend-fast와 합의된 계약을 사용합니다.",
      ],
      rust: [
        "fan-out, 세션 정리, JWT 검증, origin 제한은 성능과 보안을 함께 만족해야 합니다.",
      ],
      java: [
        "실시간 경로에서 사용하는 JWT claim/만료 정책이 Rust와 일치해야 합니다.",
      ],
    },
    verifierChecks: [
      "WebSocket 메시지 포맷 합의 여부 확인",
      "JWT 전달 방식과 origin 정책 일치 여부 확인",
    ],
  },
};

export function renderAppliedTemplatesYaml(
  categories: TemplateCategory[],
  flags: TemplateContextFlags,
): string {
  const lines: string[] = [
    "categories:",
    ...categories.map((category) => `  - ${category}`),
    "flags:",
    `  web_only: ${flags.webOnly}`,
    `  mobile_requested: ${flags.mobileRequested}`,
    `  service_wide: ${flags.serviceWide}`,
    `  hot_path_redis: ${flags.hotPathRedis}`,
    "templates:",
  ];

  for (const category of categories) {
    const template = categoryTemplateRegistry[category];
    lines.push(`  ${category}:`);
    lines.push(`    note: "${template.notes.default}"`);
    if (template.notes.variants && Object.keys(template.notes.variants).length > 0) {
      lines.push("    variants:");
      for (const [key, value] of Object.entries(template.notes.variants)) {
        lines.push(`      ${key}: "${value}"`);
      }
    }
    lines.push("    verifier_checks:");
    for (const check of template.verifierChecks) {
      lines.push(`      - "${check}"`);
    }
  }

  return lines.join("\n");
}
