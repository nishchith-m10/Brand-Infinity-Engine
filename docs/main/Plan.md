# High-Context Architect Prompt.md

@Plan Mode ACT AS: **Chief Creative Technologist (CMO Office)** & **AI Media Architect**.

**CONTEXT:**
We are building the **"Brand Infinity" Engine**.
This is NOT for kids. This is a massive-scale **"Text-to-Campaign"** pipeline designed to generate high-fidelity, cinematic marketing videos (Commercials, Social Shorts, Product Showcases).
I have a library of elite video generation workflows (`Sora`, `Veo3`, `Nano B`, `Seedream`) and strategic logic workflows (`Agentic RAG`, `DeepSeek`, `Scrapers`).2

**🚨 THE ARCHITECT'S RULES:**

1. **COMMERCIAL IMPACT:** Every output must be designed to convert. Prioritize "Viral Hooks," "Visual Spectacle," and "Persuasive Copy."
2. **BRAND SAFETY:** The system must strictly adhere to Brand Guidelines (Tone, Color Grading, Restricted Keywords).
3. **CINEMATIC FIDELITY:** We are not making cartoons. We are making "Super Bowl Quality" AI video using Sora/Veo3.

---

### **OBJECTIVE:**

Deconstruct the provided workflow library into **5 Operational Pillars** for Marketing Automation.
For **EACH** pillar, you must analyze it across **15 DISTINCT ENGINEERING DIMENSIONS** (Brand Consistency, Viral Potential, A/B Testing, etc.).

### **THE 5 PILLARS OF THE AGENCY:**

#### **1. The Strategist (Market Intelligence)**

* **Source Workflows:** `Agentic RAG Template`, `Ultimate Scraper`, `Google Maps Scraper`, `LinkedIn Workflow`.
* **Mandate:** The Trend Hunter.
* **The Logic:**
  * **Ingestion:** Scrape trending topics, competitor ads, and news. Vectorize "Winning Hooks" into the DB.
  * **Brand Brain:** Use RAG to query the "Company Brand Bible" (PDFs) to ensure all generated concepts align with the brand voice.
  * **Output:** A "Creative Brief" JSON (Target Audience, Core Message, Trending Audio).

#### **2. The Copywriter (Creative Direction)**

* **Source Workflows:** `DeepSeek V3 Chat` (Reasoning), `Prompt Chaining`, `Personalize marketing emails`.
* **Mandate:** The Script & Storyboard Artist.
* **The Logic:**
  * **Hook Generation:** Use `DeepSeek R1` to iterate on 50+ hook variations, selecting the most psychologically persuasive one.
  * **Visual Prompting:** Translate the script into dense, cinematic prompts for Sora (e.g., "Anamorphic lens, 35mm film grain, golden hour").
  * **Constraint:** Output must be segmented into 3-5 second "Scenes" for the video models.

#### **3. The Production House (Visual Synthesis)**

* **Source Workflows:** `Sora 2 Automation`, `Automate video creation with Veo3`, `Nano B Template`, `Seedream`.
* **Mandate:** The Heavy Lifting.
* **The Logic:**
  * **The Director (Router):**
    * *Hyper-Real Product Shot* -> Route to **Sora**.
    * *Fast-Paced Social Montage* -> Route to **Veo3**.
    * *Abstract/Trippy Visual* -> Route to **Seedream**.
  * **Audio:** Generate AI Voiceover (ElevenLabs) + Background Music + SFX synced to the cut.

#### **4. The Campaign Manager (State & Ledger)**

* **Source Workflows:** `Agentic RAG Template` (Postgres logic), `Sora 2 Automation` (Airtable logic).
* **Mandate:** The Producer.
* **The Logic:**
  * **Asset Management:** A Postgres table `campaigns` tracking every asset.
  * **Variant Tracking:** We don't just make one video; we make 10 variants. Track `variant_id` (e.g., "Humorous" vs "Serious") to measure performance later.
  * **Cost Ledger:** Track API spend per second of video generated.

#### **5. The Broadcaster (Distribution & formatting)**

* **Source Workflows:** `TikTok_Instagram Shorts Generator`, `Automate video creation...` (Blotato/Socials), `LinkedIn Post Agent`.
* **Mandate:** The Media Buyer.
* **The Logic:**
  * **Auto-Cropping:** Intelligent resizing (16:9 for YouTube, 9:16 for TikTok) using AI cropping (or just prompting the model correctly).
  * **Captioning:** Burn-in "Alex Hormozi Style" dynamic captions.
  * **Publication:** Schedule posts to Instagram, TikTok, LinkedIn, and YouTube Shorts via API.

---

### **EXECUTION INSTRUCTIONS:**

Generate `docs/MARKETING_CONTENT_ENGINE_ARCHITECTURE.md`.
Organize the document by the **5 Pillars**. Inside each Pillar chapter, provide a bulleted analysis of these **15 Dimensions**:

1. **Input/Output Contract:** (Strict JSON Schema entering/exiting the pillar).
2. **Brand Consistency:** (Guardrails to ensure the AI doesn't hallucinate off-brand visuals).
3. **Model Selection Strategy:** (Logic for routing: High Budget (Sora) vs Volume (Veo3)).
4. **Async Orchestration:** (Handling long render times via Webhooks).
5. **Viral Optimization:** (Mechanisms to inject trending audio/formats).
6. **Cost Efficiency:** (Reusing background assets across multiple variants).
7. **Error Propagation:** (If the Hook is weak, reject before Rendering).
8. **Asset Storage:** (High-res Master file storage strategy).
9. **Human-in-the-Loop:** (Creative Director approval step before publishing).
10. **Data Persistence:** (Postgres Schema for Campaigns and Variants).
11. **Copyright & Safety:** (Ensuring no copyrighted likenesses are generated).
12. **Latency Budgets:** (Time-to-Market targets).
13. **Scalability:** (Pipeline for generating 100+ localized ad variants).
14. **Observability:** (Tracking "Generation Success" vs "Publishing Success").
15. **A/B Testing Support:** (Architecture for tagging variants for split testing).

**OUTPUT:**
Produce the full Markdown file EDTECH_CONTENT_PIPELINE.md . Do not generate code yet; provide the architectural blueprint.
