# Smart Verify - Developer Guide

## Project Overview

Mobile app for Ethiopian businesses to verify bank/Telebirr payments. Built with React Native + Expo.

Two plans: **Normal Verify** (payment verification) and **Restaurant Plus** (everything + ordering/billing/admin).

## Key Rules

1. **No hardcoded strings** - Use useTranslation() from i18next for all UI text (English & Amharic)
2. **Use Expo-compatible packages** - Install with 
px expo install, not plain npm
3. **Strict TypeScript** - tsconfig.json has strict: true
4. **Path aliases** - Use @/ for src imports (e.g., @/components/ui/Button)
5. **Mock data first** - Backend comes later; use mock data layer in src/lib/
6. **NativeWind styling** - Use Tailwind classes; no StyleSheet for UI

## Structure

Three folders: `frontend/` (Expo phone app), `admin/` (Smart Verify team's web console, separate Expo web app) and `backend/` (API). Admin code never goes in `frontend/`. App paths below (src/...) are inside `frontend/`; run app commands from `frontend/`.

- src/app/ - Routes (file-based Expo Router)
- src/components/ui/ - Base UI components
- src/features/ - Feature-specific logic
- src/store/ - Zustand stores
- src/theme/ - Design tokens
- src/i18n/ - Translations

## Versions (Oct 2026)

- Expo SDK: 57.0.26
- React Native: 0.86.3
- React: 19.2.3
- NativeWind: 4.2.7

## Commands

- 
pm run start - Start dev server
- 
pm run typecheck - Type check
- 
pm run lint - Lint
- 
pm run format - Format code

## Phase 0 Complete

- Expo app with TypeScript & Expo Router
- NativeWind + design tokens
- Base UI components
- Zustand session store
- i18n setup
- ESLint + Prettier
- Navigation structure

## Phase 1 (Next)

- Splash, sign-in, create account, choose plan screens
- Home dashboard
- All using base components

## Working rules

- Reuse existing components, theme tokens, i18n keys, and patterns. Do not add new libraries unless unavoidable (ask first).
- Keep it simple: no new abstractions, no generic frameworks, no backend. Mock data only, in src/lib/mock.
- Small scope per task. Read only the files needed. Do not scan the whole repo.
- All UI strings through i18n (en + am keys). Touch targets >= 44, text >= 14.
- Design reference: docs/design/screens/<Name>.dc.html (read only the screen being built). Rebuild in React Native, do not copy HTML.
- Money is integer ETB. Format with the existing MoneyText.
- After each task: run typecheck + lint, then commit with a conventional message.

## Integration rules

- App is in frontend/, backend is in backend/, API base from EXPO_PUBLIC_API_URL, routes under /api/v1. Swagger at /docs is the contract: read only the routes of the module being connected.
- Each module has a real file in src/lib/api/<module>.ts with the SAME function signatures as src/lib/mock/<module>.ts. Do not edit the mock files.
- One switch per module: EXPO_PUBLIC_USE_MOCK_<MODULE> (default false) read in src/lib/<module>/index.ts. Screens import only from that index.
- The server is the source of truth for totals, tips, statuses. The app displays server values, it does not recompute them.
- Send an Idempotency-Key header (uuid per user action) on create/pay requests.
- Backend error codes map to existing i18n keys (en + am). Network failure -> generic "No connection" state with Retry.
- Lists refetch on screen focus.
- Money is integer ETB.
- After each task: typecheck + lint, commit with a conventional message.


<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance for the new AWS experience

This user has signed up for the new AWS experience. This experience lets you sign into AWS using a social provider and requires the following additional context.

Where this guidance conflicts with the project's own instructions, the project's instructions take precedence.

## Context

### Terminology:

- Say "project" instead of "account" — a project contains an AWS account and settings for sharing with other collaborators
- Say "team member" instead of "IAM user" — users are invited by email, not created or federated in IAM
- Say "AWS Settings" when referring to management tasks at [settings.aws.com](https://settings.aws.com/) (project management, billing, team members, spend limits). Users view their actual AWS resources in the AWS Management Console.
- Say "selected Region" when referring to the user's Region — not "home Region"
- The user has a managed IAM experience. This includes a managed service control policies (SCP) and resource control policies (RCP) that govern the use of AWS. They will still need to use IAM to create policies to let services work with each other. If there are questions about the SCPs or RCPs, go to the documentation at https://docs.aws.amazon.com/accounts/latest/reference/scps-and-rcps-for-projects.html

### Constraints:

- All projects share a single AWS Region determined by the user's contact address. Resources cannot be created in other Regions
- When developing:
  - MUST create all Regional resources in the project's assigned Region
  - You CAN create AWS WAF and Cloudwatch Logs resources in us-east-1 when there are global resources (like a global WAF instance) that require a connection to dependencies in us-east-1. You should not use these for any other reason, because resources in the selected Region will provide lower cost (due to no cross-Region traffic), increased availability (due to no cross-Region traffic), and easier manageability (due to not needing to look in another Region). When you need to do an inventory of resources, you need to look in both the selected Region and us-east-1 for Cloudwatch Logs or WAF resources.
  - MUST NOT attempt to create Lambda, API Gateway, or other Regional resources in any other Region
  - MUST direct users to confirm their Region in AWS Settings > View all projects > Overview > Additional Info > Region. If the user cannot confirm their Region, check in ~/.aws/config
  - MUST NOT use Lambda@Edge — excluded from both Lambda and CloudFront
  - MUST NOT use CloudFormation StackSets — no multi-account or multi-Region deployments
  - MUST NOT attempt cross-Region actions — no cross-Region replication for DynamoDB/S3/RDS, no multi-Region KMS keys
  - MUST NOT use Route 53 cross-Region routing — geolocation, latency-based, and failover routing policies are not available
  - CloudFront is a global service and its actions ARE allowed in `us-east-1`. A user can create a CloudFront distribution pointing to their project-region Lambda function URL or API Gateway. However, Lambda and API Gateway themselves MUST NOT be created in `us-east-1` — they must be in the project Region.
  - Reduced availability in `eu-north-1` specifically: Amazon Rekognition, Amazon Textract, Amazon Personalize, AWS App Runner are not available in that Region.
- IAM permissions for human access are managed by AWS. Don't assign roles to team members unless absolutely necessary
- The user may have a spend limit if they are on the paid plan. The limit that pauses their project if it's exceeded. If resources suddenly become inaccessible, ask if they have a spend limit configured. Only project owners can modify a spend limit.
- When developing:
  - MUST ask about spend limit status if the user reports sudden "Access Denied" errors on operations that previously worked
  - MUST direct users to check spend status in AWS Settings > Billing
  - MUST check if a user has upgraded their account to the paid plan
  - MUST ask the user if they want to clean up the successfully created resources or keep them to reduce cost
- The user sets up billing, creates spend limits, and retrieves and pays invoices in AWS Settings. The user creates budgets and optimizes their costs in the AWS Billing and Cost Management console
- Not all AWS services are available. If a service isn't working, do the following:
  1. Run the command `aws freetier get-account-plan-state`
  2. If accountPlanType": "FREE", check the [Free Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-free-tier) next,
  3. If accountPlanType": "PAID", check the [Paid Tier supported services list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#supported-services-paid-plan).
  4. If neither list shows the service, check the [Not supported for this experience list](https://docs.aws.amazon.com/accounts/latest/reference/supported-services-sign-up-new.html#unsupported-services). The user will need to activate advanced features to access this service.
- Users can activate advanced AWS services and capabilities for their account.
- Before starting a task, check whether a relevant AWS skill is available. Load the skill with retrieve_skill and prefer its guidance over general knowledge.

### Help level

- help_level (required): LOW, MEDIUM, or HIGH. While a user is building, you MUST ask the user: "How much guidance would you like from me? Low (I only flag security risks), medium (I ask a couple of clarifying questions if something seems off), or high (I explain what I'm doing, suggest alternatives, and flag best practices)."

You CAN update this rule file to save a user's help_level.

Constraints for each level:

**LOW:**

- MUST follow all constraints in this context file
- MUST execute the user’s request without modification
- MUST NOT ask clarifying questions unless the action would create a security vulnerability
- MUST NOT suggest alternatives or improvements

**MEDIUM:**

- MUST execute the user's request
- MAY ask up to two clarifying questions per task if the request has an ambiguity or a potential issue
- MUST NOT repeat a question or suggestion the user has already dismissed
- MUST NOT explain trade-offs or alternatives unless the user asks

**HIGH:**

- MUST explain what each step does and why before executing it
- MUST suggest alternatives when a better approach exists
- MUST flag best practices and explain trade-offs
- MUST still execute the user's choice if they disagree with a suggestion

<!-- END AWS Agent Toolkit rules -->
