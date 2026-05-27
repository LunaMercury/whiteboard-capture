# Apply Review

- run_id: run-2026-05-27T06-00-32-361Z
- role: java
- status: blocked
- summary: java proposed edits are blocked before apply.

## Approved Edits
- backend-core/src/main/resources/application.properties
- backend-core/src/main/java/com/whiteboard/core/auth/SecurityConfig.java
- backend-core/src/main/java/com/whiteboard/core/auth/AuthController.java
- backend-core/src/main/java/com/whiteboard/core/auth/CustomUserDetailsService.java
- backend-core/src/main/java/com/whiteboard/core/auth/JwtUtil.java
- backend-core/src/main/java/com/whiteboard/core/user/User.java
- backend-core/src/main/java/com/whiteboard/core/user/UserRepository.java

## Blocked Reasons
- Worker result claims verificationRun before apply. Verification must be recorded by the runner after actual file changes.

## Findings
- Policy checks attached: 4
- Contract constraints attached: 5

## Required Verification
- .skills/verify-core.ps1
