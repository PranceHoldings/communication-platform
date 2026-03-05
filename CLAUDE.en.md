# AI Avatar Communication Platform - Project Specification

**Version:** 2.0
**Created:** 2026-02-26
**Last Updated:** 2026-03-04
**Status:** Detailed Design Phase

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Use Cases](#2-use-cases)
3. [System Architecture](#3-system-architecture)
4. [Core Module Design](#4-core-module-design)
   - 4.1 [Avatar Module](#41-avatar-module)
   - 4.2 [Voice Module](#42-voice-module)
   - 4.3 [Scenario Engine](#43-scenario-engine)
   - 4.4 [Session & Recording Module](#44-session--recording-module)
   - 4.5 [Transcript & Synchronized Player](#45-transcript--synchronized-player)
   - 4.6 [Emotion & Non-verbal Analysis Module](#46-emotion--non-verbal-analysis-module)
   - 4.7 [Report Module](#47-report-module)
   - 4.8 [AI Prompt Management](#48-ai-prompt-management)
   - 4.9 [AI Provider Management](#49-ai-provider-management)
   - 4.10 [Profile Benchmark System](#410-profile-benchmark-system)
   - 4.11 [External Integration API](#411-external-integration-api)
   - 4.12 [Subscription & Plan Management](#412-subscription--plan-management)
   - 4.13 [Multi-language Support System](#413-multi-language-support-system)
   - 4.14 [ATS Integration System](#414-ats-integration-system)
   - 4.15 [Plugin System](#415-plugin-system)
5. [Multi-tenant & Permission Design](#5-multi-tenant--permission-design)
6. [Database Design](#6-database-design)
7. [API Design](#7-api-design)
8. [Technology Stack](#8-technology-stack)
9. [Infrastructure Configuration (AWS Serverless)](#9-infrastructure-configuration-aws-serverless)
10. [Implementation Phases](#10-implementation-phases)
11. [External Services & Licenses](#11-external-services--licenses)
12. [Security & Privacy](#12-security--privacy)

---

## 1. Project Overview

### Concept

A **[Multi-tenant](docs/GLOSSARY.md#multi-tenant-マルチテナント) SaaS** platform where [AI Avatars](docs/GLOSSARY.md#avatar) conduct real-time interactive conversations with users. Based on pre-configured [scenarios](docs/GLOSSARY.md#scenario), AI avatars autonomously lead conversations, which are recorded, analyzed, and reported.

**Multi-tenant SaaS Characteristics:**

- Manages multiple organizations ([tenants](docs/GLOSSARY.md#tenant-テナント)) with complete isolation on a single infrastructure
- Each organization maintains independent data domains, settings, and user management
- Scalable architecture supporting thousands of organizations simultaneously
- Complete data separation between tenants (Row Level Security)
- Per-organization customization (branding, AI settings, report templates)

### Key Features Summary

| Category | Features |
| -------- | -------- |
| **Architecture** | Multi-tenant SaaS, 3-tier user roles, AWS Serverless ★ |
| **Subscription** | Plan management (Free/Pro/Enterprise), flexible UI configuration, Stripe integration ready ★ |
| **Avatar** | 2D/3D presets, user image generation, anime/realistic styles, UI selection system ★ |
| **Voice** | Preset selection, voice file upload, real-time recording, voice cloning |
| **Conversation AI** | Scenario-based autonomous conversation, multi-provider support (Claude/GPT-4/Gemini, etc.) ★ |
| **AI Management** | Prompt template management, provider switching, cost management (admin-only) ★ |
| **Recording** | Simultaneous recording, composition, and playback of avatar + user camera footage |
| **Transcript** | Timestamped, synchronized clickable transcript with video |
| **Analysis** | Facial expression, emotion, non-verbal behavior analysis, voice feature analysis |
| **Reports** | Automated report generation with customizable templates |
| **Benchmark** | Profile comparison, growth tracking, personalized improvement suggestions ★ |
| **External API** | API key management, hierarchical rate limiting, Webhooks, OpenAPI specification ★ |
| **Multi-language** | Japanese & English (initial), future multilingual expansion, UI/Scenario/Report support ★ |
| **ATS Integration** | Support for 6 major domestic and international providers, candidate sync, result export, Webhook integration ★ |
| **Plugin System** | Extensible architecture, SDK provided, marketplace (future) ★ |
| **Platform Management** | Tenant management, global settings, overall monitoring (Super Admin) ★ |

★ = v2.0 new/enhanced features

### Target Markets

- **Job Hunting & Recruitment Support:** Interview practice, standardized hiring processes, quantified candidate evaluation
- **Language Learning:** Conversation practice, pronunciation & expression feedback, multilingual support
- **Corporate Training:** Customer service, sales, complaint handling training, skill evaluation
- **Research:** Surveys, market research, automated user interviews
- **Educational Institutions:** Unified platform usage across multiple schools/departments, student benchmarking
- **Recruitment Agencies & HR Companies:** Multi-client management, standardized evaluation criteria

### Multi-tenant SaaS Advantages

**For Organizations (Tenants):**

- No initial investment (reduced infrastructure construction and maintenance costs)
- Immediate availability (setup time < 1 hour)
- Auto-scaling (10 users → 10,000 users supported)
- Always on the latest version (automatic updates)
- Security through complete data separation

**For Platform Operators:**

- Manage thousands of organizations on a single infrastructure
- Optimized operational costs (resource sharing)
- Data-driven feature improvements (cross-tenant analysis)
- Scale advantages (cost reduction with increasing contracts)

### Deployment Format

**Large-scale Multi-tenant SaaS (500+ users, thousands of organizations)**

- **Architecture:** AWS Serverless (Lambda, Aurora Serverless v2, DynamoDB)
- **Tenant Management:** Complete isolation management of thousands of organizations on single infrastructure
- **Scalability:** Auto-scale (10 users → 100,000 users supported)
- **Availability:** 99.9% SLA, Multi-AZ deployment, automatic failover
- **Cost Efficiency:** Usage-based billing, minimized idle-time costs
- **Maintenance:** Fully managed, no server management required
- **Global Deployment:** CloudFront CDN, multi-region support available
- **Multi-language:** Initially Japanese & English, easily extensible design
- **Subscription:** Flexible plan management, Stripe integration ready
- **Extensibility:** Easy feature expansion through plugin system

---

## 2. Use Cases

### 2.1 Job Interview Practice

```
User → Scenario selection (industry, position, difficulty)
     → Mock interview with AI avatar interviewer (30 minutes)
     → Recording & transcript generation
     → Emotion & non-verbal analysis report
     → Review improvement feedback
```

### 2.2 Language Learning & Conversation Practice

```
User → Language & level settings
     → Free conversation or specific scene practice with native avatar
     → Speech rate, vocabulary, fluency evaluation report
     → Highlight scenes (good expressions & areas for improvement) review
```

### 2.3 Customer Service Training

```
Administrator → Set up & distribute complaint scenarios and evaluation criteria
Trainees      → Practice dialogue with complaint customer avatar
Administrator → Review & compare reports from all trainees
```

### 2.4 Surveys & Market Research

```
Survey Designer → Set up questionnaire scenario & interaction methods
Respondents     → Answer survey in natural conversational format with avatar
Survey Designer → Obtain conversation logs, emotional data, and summary reports
```

---

## 3. System Architecture

### Overall Architecture Diagram (Serverless Architecture)

```
┌───────────────────────────────────────────────────────────────────┐
│                   Frontend (Next.js 15 + AWS Amplify)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │ Avatar   │ │ Scenario │ │ Session  │ │ Report   │ │  Admin  ││
│  │ Selector │ │ Builder  │ │ Player   │ │ Viewer   │ │  Panel  ││
│  │          │ │          │ │          │ │          │ │ (Prompt/││
│  │          │ │          │ │          │ │          │ │Provider)││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
└────────────────┬──────────────────────┬───────────────────────────┘
                 │                      │
                 │ REST API             │ WebSocket (IoT Core)
                 ▼                      ▼
┌────────────────────────────┐ ┌────────────────────────────┐
│   API Gateway (REST)       │ │   AWS IoT Core             │
│   - Lambda Authorizer      │ │   - WebSocket API          │
│   - Usage Plans            │ │   - Real-time Communication│
│   - Rate Limiting          │ │   - 1M Concurrent Connections│
└──────────┬─────────────────┘ └───────────┬────────────────┘
           │                               │
           ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│              Amazon Cognito (Authentication, Authorization,   │
│              User Management)                                 │
│              - User Pools, Identity Pools                     │
│              - OAuth2, SAML SSO, MFA                          │
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│                     AWS Lambda Functions                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Avatar   │ │ Scenario │ │ Session  │ │ AI Prompt│       │
│  │ CRUD     │ │ CRUD     │ │ Manager  │ │ Manager  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ AI       │ │ WebSocket│ │ Recording│ │ Report   │       │
│  │ Provider │ │ Handler  │ │ Upload   │ │ Generator│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└────┬───────────────────────────────────────────┬─────────────┘
     │                                           │
     ▼                                           ▼
┌────────────────────┐              ┌────────────────────────┐
│ Aurora Serverless  │              │     DynamoDB           │
│ v2 (PostgreSQL)    │              │  - Session State       │
│ - Master Data      │              │  - WebSocket Connection│
│ - Users & Orgs     │              │  - Real-time Data      │
│ - Prompt Settings  │              │  - TTL Auto-delete     │
└────────────────────┘              └────────────────────────┘
     │                                           │
     └───────────────────┬───────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              EventBridge + Step Functions                     │
│              (Asynchronous Processing Orchestration)          │
│                                                               │
│  Session Completion Event                                     │
│    ↓                                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Step Functions Workflow                              │    │
│  │  1. Recording Verification (Lambda)                  │    │
│  │  2. Video Composition (MediaConvert)                 │    │
│  │  3. Thumbnail Generation (Lambda) [Parallel]         │    │
│  │  4. Transcript Regeneration (Lambda) [Parallel]      │    │
│  │  5. Emotion Analysis (Lambda → Azure Face API)       │    │
│  │  6. Voice Analysis (Lambda → Azure Speech)           │    │
│  │  7. AI Report Generation (Lambda → Claude API)       │    │
│  │  8. PDF Generation (Lambda + Puppeteer Layer)        │    │
│  │  9. Notification (SNS)                               │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│              Amazon S3 + CloudFront CDN                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │  Recordings│ │  Avatars   │ │  Reports   │              │
│  │  (Video/Audio)│ │  (Models)  │ │  (PDF)     │            │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                               │
│  - Encryption (SSE-KMS)                                      │
│  - Lifecycle Policy (Auto-delete, Migration)                 │
│  - CloudFront Signed URLs (Secure Distribution)              │
└──────────────────────────────────────────────────────────────┘
```

### Serverless Architecture Features

**1. Fully Managed & Auto-scaling**

- Lambda: Auto-scales according to request count (0 → 1000+ concurrent executions)
- Aurora Serverless v2: Automatic ACU adjustment based on load (0.5 → 16 ACU)
- DynamoDB: Unlimited scaling with on-demand mode
- IoT Core: Supports 1 million concurrent WebSocket connections

**2. Cost Efficiency**

- Usage-based billing (minimized idle-time costs)
- Lambda ARM64 (Graviton2): 20% cost reduction
- S3 Intelligent-Tiering: Automatic cost optimization
- Estimated cost (1000 sessions/month): $500-800

**3. High Availability & Scalability**

- Multi-AZ deployment (Aurora, Lambda)
- Automatic failover (RTO < 1 minute)
- Global CDN distribution (CloudFront)
- 99.9% SLA

**4. Maintainability**

- No server management (automatic patching & OS updates)
- Infrastructure as Code (AWS CDK) management
- Distributed tracing (X-Ray) for rapid issue identification
- CloudWatch integrated monitoring

---

_[Translation continues - This is the first portion of the document. The complete English translation is being created progressively...]_
### Real-time Communication Flow (Serverless)

```
Browser                 IoT Core + Lambda              External API
   │                           │                            │
   │── WebSocket Connection ──>│                            │
   │   (wss://iot-endpoint)    │                            │
   │                           │← Lambda (onConnect)        │
   │                           │  - DynamoDB: Save connection info  │
   │                           │  - Cognito: Verify authentication │
   │<─ Connection Established ─│                            │
   │                           │                            │
   │── Start Session ─────────>│← Lambda (sessionStart)     │
   │   { type: "start",        │  - Aurora: Create session  │
   │     scenario_id: "..." }  │  - DynamoDB: Initialize state    │
   │                           │                            │
   │                           │── Claude API ─────────────>│
   │                           │   (Load system prompt)  │
   │<─ Opening Speech Text ────│<─ AI Response ────────────│
   │                           │                            │
   │                           │── ElevenLabs TTS ─────────>│
   │<─ Audio Stream ───────────│<─ Audio + Viseme Data ────│
   │  + Viseme Data          │   (Streaming)         │
   │  (Avatar lip-sync starts)  │                            │
   │                           │                            │
   │── User Speech (Audio) ────>│← Lambda (audioChunk)       │
   │   ArrayBuffer chunks      │  - S3: Temporary storage            │
   │                           │  - Azure STT Call ─────────>│
   │<─ Real-time Subtitles ────│<─ Text (incremental) ──────│
   │   (incremental updates)              │                            │
   │                           │                            │
   │── Speech End ─────────────>│← Lambda (speechEnd)        │
   │   { type: "speech_end" }  │  - DynamoDB: Record speech      │
   │                           │  - Claude API ─────────────>│
   │                           │    (with context)       │
   │                           │<─ Response Text ────────────│
   │                           │                            │
   │                           │── ElevenLabs TTS ─────────>│
   │<─ Audio + Viseme ──────────│<─ Audio Data ───────────────│
   │                           │                            │
   │       [Conversation Repeats]       │                            │
   │                           │                            │
   │── End Session ────────────>│← Lambda (sessionEnd)       │
   │                           │  - Aurora: Update session  │
   │                           │  - EventBridge: Publish event│
   │                           │    → Trigger Step Functions    │
   │<─ Completion Notice ───────│                            │
   │                           │                            │
   │── WebSocket Disconnect ────>│← Lambda (onDisconnect)     │
   │                           │  - DynamoDB: Delete connection      │
```

**Serverless Architecture Benefits:**

1. **Auto-scaling:** Automatically handles increase from 100 → 10,000 concurrent connections
2. **Low Latency:** Global deployment with Lambda@Edge + IoT Core
3. **Cost Efficiency:** Connection time-based billing (zero cost when idle)
4. **High Availability:** Multi-AZ automatic failover

---

## 4. Core Module Design

### 4.1 Avatar Module

#### Avatar Types and Generation Methods

| Type | Source | Generation Method | Rendering | Access Rights |
| ---------------------- | ---------------------------- | ------------------------------------------ | ---------------------- | ---------- |
| 2D Anime (Preset) | Live2D ready-made models | Select from library | Canvas 2D / Live2D SDK | All users |
| 2D Anime (From Image) | User upload | AnimeGAN style conversion + facial landmark driven | Canvas 2D | Pro and above |
| 3D Realistic (Preset) | Ready Player Me standard models | Select from library | Three.js / WebGL | All users |
| 3D Realistic (From Image) | User upload | RPM Photo Capture API | Three.js / WebGL | Pro and above |

#### Avatar Selection UI (For End Users)

```
┌──────────────────────────────────────────────────────────────┐
│ Avatar Selection                                    [My Avatars] │
├──────────────────────────────────────────────────────────────┤
│ 📂 Category Filter                                           │
│ [All] [2D Anime] [3D Realistic] [My Library]              │
│                                                               │
│ 🎨 Style Filter                                           │
│ [All] [Business] [Casual] [Friendly] [Formal] │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Preset Avatars                                       │  │
│ │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐            │  │
│ │ │ 👩‍💼│ │ 👨‍💼│ │ 🧑‍🎓│ │ 👩‍🏫│ │ 🧑‍💻│ │ 👨‍⚕️│ ...         │  │
│ │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘            │  │
│ │ Alex   Sarah  Ken    Lisa   Mike   Emma              │  │
│ │ [Select] [Select] [Select] [Select] [Select] [Select]              │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Create Custom Avatar (Pro and above)                 [+ New]  │  │
│ │ ┌────┐ ┌────┐ ┌────┐                                   │  │
│ │ │ 📷 │ │ 🖼️ │ │ 🎨 │                                   │  │
│ │ └────┘ └────┘ └────┘                                   │  │
│ │ Photo    Image    AI Generated                                   │  │
│ │ Upload    2D/3D                                    │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ Selected: Alex (3D Realistic・Business)            [Preview]  │
│                                               [Start with this setting] │
└──────────────────────────────────────────────────────────────┘
```

**Selection Flow:**

1. **User accesses avatar selection screen before starting session**
2. **Filter by category and style**
3. **Click avatar card to display preview**
   - View real-time 3D/2D model in action
   - Test lip-sync with sample audio
4. **Click "Start with this setting" to proceed to session configuration**

**Preset Avatar Management (Administrator):**

- Administrators can add organization-specific custom preset avatars
- Set tags, categories, and visibility scope for each avatar
- Avatar library version management

#### Avatar Generation Pipeline from Images

```
User Image Upload
        │
        ▼
   Face Detection & Quality Check (MediaPipe)
   ├── No face detected → Return error
   └── Insufficient quality → Request re-upload
        │
        ├──[2D Anime Style]──────────────────────────────────┐
        │   1. Background removal (Remove.bg API)                   │
        │   2. Anime conversion (AnimeGANv2)                      │
        │   3. Facial parts mask generation (eyes/mouth/eyebrows)              │
        │   4. MediaPipe facial landmarks → Parts transformation      │
        │   5. Lip-sync: Viseme → Mouth shape mapping    │
        │                                                  │
        └──[3D Realistic Style]──────────────────────────────────┘
            1. Ready Player Me Photo Capture API
            2. Obtain GLB format 3D model
            3. Lip-sync with ARKit 52 Blendshapes
            4. Render with Three.js
```

#### Lip-sync Implementation

- **2D:** Estimate Viseme (mouth shape) from audio waveform, map to Live2D / Canvas parameters
- **3D:** Control ARKit 52 Blendshapes (jawOpen, mouthFunnel, etc.) from TTS Viseme data
- **ElevenLabs:** Utilize Alignment data included in `/v1/text-to-speech` response

#### Expression System

```typescript
// Emotion state → Avatar expression parameter mapping example
const emotionToExpression: Record<string, AvatarParams> = {
  neutral: { mouthSmile: 0.0, eyeWide: 0.0, browRaise: 0.0 },
  happy: { mouthSmile: 0.8, eyeWide: 0.3, browRaise: 0.1 },
  confused: { mouthSmile: 0.0, eyeWide: 0.2, browRaise: 0.5 },
  serious: { mouthSmile: 0.0, eyeWide: 0.0, browRaise: -0.3 },
  surprised: { mouthSmile: 0.2, eyeWide: 0.9, browRaise: 0.8 },
};
```

---

### 4.2 Voice Module

#### Voice Sources and Processing Flow

```
[Preset]                [File Upload]         [Browser Recording]
     │                              │                           │
     │                    Receive WAV/MP3/M4A              MediaRecorder API
     │                    Quality check                  (Recommended: 30 sec to 2 min)
     │                    (SNR / Duration / Clipping)          │
     └──────────────────────┴───────────────────────────────────┘
                                    │
                           ElevenLabs Voice
                           Cloning API
                           → Generate voice_id & save to DB
                                    │
                           Register to user voice library
```

#### STT (Speech Recognition)

- **Engine:** Azure Cognitive Services Speech-to-Text
- **Mode:** Real-time streaming recognition
- **Supported Languages:** 40+ languages
- **Output:** Text + timestamp + confidence score

#### TTS (Text-to-Speech)

- **Engine:** ElevenLabs API
- **Output Format:** MP3 / PCM (streaming)
- **Additional Data:** Alignment (character-by-character timestamps) → Used for Viseme conversion

#### Voice Cloning Terms of Use

When using voice cloning, the following consent flow is mandatory:

```
┌─────────────────────────────────────────────────────┐
│  Voice Cloning Confirmation                       │
│                                                      │
│  Regarding the audio to be uploaded or recorded:             │
│  ☑ This is my own voice or I have usage rights   │
│  ☑ I confirm no infringement of third-party rights       │
│  ☑ I agree to the service terms of use                   │
│                                                      │
│                    [Agree and Continue]                   │
└─────────────────────────────────────────────────────┘
```

---

### 4.3 Scenario Engine

#### Scenario Configuration Schema

```yaml
scenario:
  id: 'scenario_uuid'
  title: 'Engineer Recruitment Interview - Intermediate'
  category: 'job_interview' # job_interview / language / customer_service / survey
  language: 'en'
  max_duration_min: 30
  visibility: 'private' # private / organization / public

  avatar_persona:
    role: 'HR Manager'
    personality: 'professional' # friendly / professional / strict / casual
    pressure_level: 3 # 1-5
    background: |
      HR Manager at IT company, 10 years of experience.
      Specializes in technical hiring and values logical thinking.

  conversation_flow:
    opening: 'Thank you for joining us today. Could you please start with a self-introduction?'
    required_topics:
      - 'Self-introduction and background'
      - 'Technical skills verification'
      - 'Teamwork experience'
      - 'Motivation for applying'
      - 'Career vision'
    follow_up_questions: true
    transition_style: 'natural' # natural / structured

  interaction_params:
    style: 'structured' # structured / free / mixed
    response_wait_sec: 30 # Maximum wait time for user response
    interruption: false # Allow interruption

  evaluation_criteria:
    - metric: 'Logical explanation ability'
      weight: 0.30
      rubric: 'Can explain logically with specific examples'
    - metric: 'Eye contact'
      weight: 0.20
      rubric: 'Percentage of time facing camera'
    - metric: 'Speaking pace and timing'
      weight: 0.20
      rubric: 'Maintains appropriate WPM (120-160)'
    - metric: 'Vocabulary and expressiveness'
      weight: 0.30
      rubric: 'Uses appropriate vocabulary for the position'

  report_template_id: 'tpl_interview_standard'
```

