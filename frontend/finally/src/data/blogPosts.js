/**
 * FinAlly Blog Posts — static data store.
 * Each post is a plain object. `content` is an array of sections
 * with type: 'heading' | 'subheading' | 'paragraph' | 'callout' | 'list' | 'divider'
 */

export const AUTHORS = {
  sayak: {
    name: 'Sayak Mondal',
    role: 'Developer, FinAlly · ByteStorm',
    avatar: 'SM',
    bio: 'Full-stack developer at ByteStorm. Builds the AI engine and backend infrastructure for FinAlly. Passionate about making secure, intelligent financial tools accessible to everyone.',
  },
};

export const BLOG_POSTS = [
  {
    slug: 'security-measures-finally',
    title: 'Security at FinAlly: What We Protect, What We Honestly Cannot — and Where We Are Headed',
    subtitle: 'A candid technical breakdown of every security layer in FinAlly, the real risks of running AI agents with your financial data online, and the game-changing mitigations we are building.',
    author: 'sayak',
    date: '2026-03-31',
    readTime: '12 min read',
    tags: ['Security', 'Engineering', 'Transparency', 'AI Safety'],
    coverGradient: 'linear-gradient(135deg, #0a1929 0%, #0d2137 50%, #071523 100%)',
    excerpt: 'We talk openly about what FinAlly does right, where the honest risks lie, and why we believe the future of secure AI finance is not local LLMs — it is better-engineered online agents.',
    content: [
      {
        type: 'paragraph',
        text: `I want to have an honest conversation about security. Not the polished PR version where everything is perfect and "enterprise-grade" — but a real engineering breakdown of what FinAlly protects today, where the actual risks live, and exactly what we are building to address them.`,
      },
      {
        type: 'paragraph',
        text: `This post is also a direct response to a question we get fairly often: "Isn't it more secure to just run a language model locally on my own machine rather than trusting an online agent like FinAlly with my financial data?" It is a completely valid concern. Let me answer it honestly.`,
      },

      // ── Section 1 ─────────────────────────────────────────────────────────
      {
        type: 'heading',
        text: '1. What FinAlly Already Protects — The Security Stack',
      },
      {
        type: 'paragraph',
        text: `Let us start with what is actually in place. FinAlly is not a weekend prototype — every layer from the database to the browser was built with specific threat models in mind.`,
      },
      {
        type: 'subheading',
        text: 'Authentication & Identity',
      },
      {
        type: 'list',
        items: [
          '**JWT (HS256, 2880-hour expiry)** — Every protected API call requires a signed token. Tokens are issued only after full 2FA completion and are never stored in the database; validation is stateless.',
          '**OTP Two-Factor Authentication (TOTP via pyotp)** — Signup and login both require a 6-digit time-based OTP delivered to your registered email. The OTP window is 5 minutes. No login completes without it.',
          '**bcrypt password hashing** — We never store plaintext or weakly-hashed passwords. Bcrypt\'s adaptive work factor makes brute-force attacks computationally impractical even if the database were compromised.',
          '**Account-locked routes** — Profile, wallet, trading, and conversation endpoints all use `get_current_user` as a FastAPI dependency, which verifies the JWT and the OTP-verified status on every single request.',
        ],
      },
      {
        type: 'subheading',
        text: 'API & Transport Security',
      },
      {
        type: 'list',
        items: [
          '**HTTPS/TLS in production** — All traffic between your browser and our servers is encrypted in transit. Plain HTTP is rejected.',
          '**CORS controls** — The backend allows only our frontend origin. Cross-origin requests from unknown domains are blocked at the FastAPI CORS middleware layer.',
          '**Rate limiting (slowapi, 60 req/min/IP)** — Prevents brute-force, credential stuffing, and API scraping attacks. Exceeding the limit returns a 429 with a Retry-After header.',
          '**Input validation via Pydantic** — All request bodies are parsed through typed Pydantic schemas. Malformed or oversized payloads are rejected before they reach any business logic.',
        ],
      },
      {
        type: 'subheading',
        text: 'AI Agent Safety Layer',
      },
      {
        type: 'list',
        items: [
          '**Safety guardrails (safety.py)** — Every user query passes through a risky-query detector before reaching the LLM. Queries containing manipulation attempts, jailbreaks, or harmful financial instructions are blocked with an explanatory response.',
          '**Per-user rate limiting (20 req/60s)** — The AI agent has its own rate limiter, separate from the global one, to prevent abuse and runaway API costs.',
          '**Grounding prompts** — The LLM is strictly instructed to base responses only on structured data provided from our tools (yfinance, calculators, scraped news). It cannot hallucinate stock prices or fabricate statistics that the tool layer did not provide.',
          '**No PII in LLM context** — We do not pass your full name, email, or phone number into the LLM prompt. The AI agent receives only your query, relevant financial data, and a summary of recent conversation context.',
        ],
      },
      {
        type: 'subheading',
        text: 'Data Storage',
      },
      {
        type: 'list',
        items: [
          '**MongoDB Atlas (TLS encrypted at rest and in transit)** — Your user record, wallet balance, and conversation history are stored in MongoDB Atlas, which encrypts data at rest using AES-256.',
          '**Password hashes only** — We store `password_hash` (bcrypt), never plaintext.',
          '**Conversation pruning** — The agent\'s memory layer keeps only the last 20 messages per session. We do not retain indefinite conversation logs.',
        ],
      },

      // ── Section 2 ─────────────────────────────────────────────────────────
      {
        type: 'heading',
        text: '2. The Honest Security Risks — We Will Not Pretend Otherwise',
      },
      {
        type: 'callout',
        variant: 'warning',
        text: 'This section is intentionally candid. We believe you deserve to understand the real risk surface of an online AI financial agent before trusting it with sensitive queries.',
      },
      {
        type: 'paragraph',
        text: `Every online service has a threat model, and FinAlly is not immune. Here are the risks we acknowledge:`,
      },
      {
        type: 'subheading',
        text: 'Risk 1: Your queries reach third-party LLM APIs',
      },
      {
        type: 'paragraph',
        text: `When you ask FinAlly something, your query and relevant financial context are sent to OpenAI's API (gpt-4o-mini) or Google's Gemini API to generate a response. This means your message — potentially mentioning specific stocks, portfolio sizes, or investment strategies — leaves our servers and is processed by a third-party model.`,
      },
      {
        type: 'paragraph',
        text: `OpenAI and Google both have enterprise data-handling agreements and claim they do not use API data for training by default. But the architectural reality is: your query travels outside our control. If you are asking highly sensitive questions (exact holding quantities, specific financial strategies for large amounts), that context touches their infrastructure.`,
      },
      {
        type: 'subheading',
        text: 'Risk 2: Conversation history is stored server-side',
      },
      {
        type: 'paragraph',
        text: `Your chat conversations are persisted in MongoDB to enable FinAlly's conversational memory — so it remembers context from message to message. This is a core feature, but it also means your financial questions and the AI's analysis live in our database. In the event of a database breach (despite encryption at rest), conversation content could be exposed.`,
      },
      {
        type: 'subheading',
        text: 'Risk 3: Prompt injection attacks',
      },
      {
        type: 'paragraph',
        text: `Like all LLM-based applications, FinAlly is theoretically vulnerable to prompt injection — where a malicious actor could craft a query designed to override the system prompt or extract information about the agent's configuration. Our safety layer catches most such attempts, but no prompt injection filter is 100% perfect. We actively monitor for and patch injection vectors.`,
      },
      {
        type: 'subheading',
        text: 'Risk 4: API key exposure (server-side only, but still a risk)',
      },
      {
        type: 'paragraph',
        text: `FinAlly's API keys for OpenAI, Gemini, and MongoDB live in a server-side \`.env\` file. They are never exposed to the browser. However, if the server were compromised, those keys could be extracted. We mitigate this with key rotation policies and environment variable management, but the risk exists at any cloud-hosted service.`,
      },
      {
        type: 'subheading',
        text: 'Risk 5: JWT token theft',
      },
      {
        type: 'paragraph',
        text: `JWT tokens are stored in browser \`localStorage\`. If an attacker achieves XSS (cross-site scripting) on our frontend, they could steal your token and act as you until expiry. We sanitise all rendered content and use Content-Security-Policy headers, but XSS is a persistent attack surface in any web application. Moving to \`httpOnly\` cookies is on our roadmap.`,
      },

      // ── Section 3 ─────────────────────────────────────────────────────────
      {
        type: 'heading',
        text: '3. "Why Not Just Run a Local LLM?" — A Fair Debate',
      },
      {
        type: 'paragraph',
        text: `Running a language model like LLaMA 3, Mistral, or Phi-3 locally on your machine is genuinely appealing from a privacy perspective. Your queries never leave your hardware. No third-party API sees your prompts. There is no server to breach.`,
      },
      {
        type: 'paragraph',
        text: `We think this is a completely legitimate choice for people with the technical capability to do it and the hardware to run a capable model (a 70B-parameter model needs 40+ GB of VRAM for reasonable quality). Here is our honest comparison:`,
      },
      {
        type: 'list',
        items: [
          '**Privacy**: Local LLM wins decisively. Queries never leave your machine.',
          '**Financial reasoning quality**: Online frontier models (GPT-4o, Gemini 2.5 Flash) are significantly more capable at nuanced financial analysis than 7B–13B local models. A local model answering "Should I invest in HDFC Bank?" will give you a far less structured, less accurate thesis than our grounded Advisor Mode.',
          '**Real-time data**: Local LLMs have no internet access by default. They cannot fetch live stock prices, RSI, support/resistance, or market news. FinAlly\'s entire tool layer — yfinance, trend analysis, market overview, news scraper — is unavailable locally.',
          '**Maintenance burden**: Running a local LLM requires model downloads (4–40 GB), inference infrastructure (Ollama, LM Studio), and regular updates. For most retail investors, this is a significant overhead.',
          '**The grounding problem**: Ungrounded local LLMs are more likely to confidently hallucinate stock prices or company metrics than a grounded agent that fetches real data before responding.',
        ],
      },
      {
        type: 'callout',
        variant: 'info',
        text: 'Our position: local LLMs are a valid privacy-maximising choice for technical users who accept the trade-offs in quality and real-time data. For the vast majority of users who want accurate, data-grounded financial insights, a well-engineered online agent with strong security controls is a better fit — and that is exactly what we are building FinAlly to be.',
      },

      // ── Section 4 ─────────────────────────────────────────────────────────
      {
        type: 'heading',
        text: '4. What We Are Building — Upcoming Security & Privacy Features',
      },
      {
        type: 'paragraph',
        text: `Acknowledging the risks is only half the job. Here is exactly what is on our security roadmap:`,
      },
      {
        type: 'subheading',
        text: 'httpOnly Cookies for JWT (replacing localStorage)',
      },
      {
        type: 'paragraph',
        text: `We are migrating JWT storage from \`localStorage\` to \`httpOnly\` cookies. This eliminates the XSS token-theft vector entirely — JavaScript cannot read \`httpOnly\` cookies, meaning even a successful XSS attack cannot exfiltrate your session token. This is the single highest-impact security change on our roadmap.`,
      },
      {
        type: 'subheading',
        text: 'Zero-Retention Conversation Mode',
      },
      {
        type: 'paragraph',
        text: `We are building an opt-in "private session" mode where your conversation is processed entirely in-memory and never written to MongoDB. When you close the session, it is gone. This is for users who want the quality of our grounded AI agent with zero persistence of their financial queries.`,
      },
      {
        type: 'subheading',
        text: 'Query Anonymisation Before LLM Dispatch',
      },
      {
        type: 'paragraph',
        text: `Before your query reaches OpenAI or Gemini, we are building a pre-processing layer that strips or replaces personally identifying patterns. Mentions of specific account sizes above certain thresholds, exact portfolio compositions, and identifiable financial details will be abstracted to relative terms before the prompt leaves our servers. The LLM reasons about "a large-cap portfolio with moderate risk" rather than "my ₹47 lakh portfolio in HDFC and TCS."`,
      },
      {
        type: 'subheading',
        text: 'End-to-End Encrypted Conversation Storage',
      },
      {
        type: 'paragraph',
        text: `Even with MongoDB Atlas's AES-256 at-rest encryption, a breach of our database admin credentials could expose conversation content. We are implementing client-side encryption: conversations will be encrypted in the browser using a key derived from your password before being sent to the server. We will hold the ciphertext; only you hold the key.`,
      },
      {
        type: 'subheading',
        text: 'Refresh Token Rotation + Revocation',
      },
      {
        type: 'paragraph',
        text: `Our current JWT implementation uses long-lived access tokens (2880 hours). We are moving to a short-lived access token (15 minutes) + rotating refresh token architecture. This dramatically limits the damage window if a token is compromised. Tokens can also be individually revoked (for logout, suspicious activity, or account takeover response).`,
      },
      {
        type: 'subheading',
        text: 'Security Audit Log (User-Visible)',
      },
      {
        type: 'paragraph',
        text: `We are building a user-visible security log in the Profile page — every login event, IP address, device fingerprint, and failed authentication attempt will be visible to you. If someone else logs into your account, you will know. This moves FinAlly from implicit security to transparent security.`,
      },
      {
        type: 'subheading',
        text: 'Adversarial Prompt Injection Detection (ML-Based)',
      },
      {
        type: 'paragraph',
        text: `Our current safety layer is rule-based. We are training a lightweight classifier — fine-tuned on financial domain prompt injection examples — that will run before the LLM call to flag adversarial or jailbreak-pattern inputs with much higher precision than keyword matching.`,
      },

      // ── Section 5 ─────────────────────────────────────────────────────────
      {
        type: 'heading',
        text: '5. Our Commitment',
      },
      {
        type: 'paragraph',
        text: `Security is not a feature we ship once. It is an ongoing engineering discipline. We commit to:`,
      },
      {
        type: 'list',
        items: [
          '**Radical transparency** — When we discover a vulnerability or limitation, we will write about it publicly, like this post.',
          '**No surprise data sharing** — We will never sell, share, or use your conversation data for anything other than powering your FinAlly session.',
          '**Responsible disclosure** — If you discover a security issue, email us. We will respond within 48 hours, fix it, and credit you publicly if you wish.',
          '**User control first** — Every privacy feature we build will be opt-in where possible, and we will never make security trade-offs that prioritise our convenience over your safety.',
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'paragraph',
        text: `FinAlly is not perfect yet. No online service is. But we are building it with the honest intention of being the most security-conscious AI financial agent available — not just in terms of marketing language, but in engineering decisions, roadmap priorities, and transparency with our users.`,
      },
      {
        type: 'paragraph',
        text: `If you have questions, concerns, or suggestions about our security architecture, I am reachable directly. Security conversations are always welcome.`,
      },
      {
        type: 'callout',
        variant: 'info',
        text: '— Sayak Mondal, Developer · ByteStorm / FinAlly · March 2026',
      },
    ],
  },
];

export default BLOG_POSTS;
