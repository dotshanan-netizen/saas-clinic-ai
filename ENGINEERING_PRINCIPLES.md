# Clinova Engineering Principles

This document codifies the core engineering principles for the Clinova platform. These rules govern all code changes, bug fixes, feature implementations, and architectural decisions.

---

## 🛡️ Core Principles

### 1. Structural Hardening over Local Patching
* **Statement:** No code change or fix shall be accepted if it only addresses the immediate symptom. Every modification must target and eliminate the underlying structural/architectural cause that allowed the class of error to manifest in the first place.
* **Rationale:** Local patches lead to codebase decay, logical contradictions, and regression fragility. Structural hardening ensures long-term system stability, predictable behaviors, and a clean code design.
* **Example:** Instead of adding a hardcoded text fallback or modifying the prompt to ask for missing doctors, we refactored the validation gate and booking orchestrator to dynamically determine missing fields, auto-resolve single doctors, and support "Any Doctor" scheduling directly based on active database relationships.

### 2. Data-Driven Dialogue over Prompt Overloading
* **Statement:** The conversational flow must adapt dynamically based on the state of the tenant's database configuration (branches, services, doctor relationships, working hours) rather than relying on bloated, static instructions inside the AI model's prompt.
* **Rationale:** Prompt bloating increases latency, costs, and the chance of model hallucinations. Grounding the dialogue flow in code-enforced database relationships ensures absolute consistency and safety.

### 3. Strict 5-Gate System Validation
* **Statement:** Every release or fix must successfully pass through five distinct validation gates before being promoted to production:
  1. **Unit Tests:** Validating core domain logic, time normalization, and data validation rules in complete isolation.
  2. **Integration Tests:** Verifying API security, multi-tenancy isolation guards, and database state transitions.
  3. **Simulator E2E:** Testing the complete webhook-to-response pipeline with simulated payloads.
  4. **WhatsApp Production E2E:** Live validation sending messages via the WhatsApp Meta Cloud API to verify real-time connectivity.
  5. **Dashboard Verification:** Confirming real-time updates and ensuring that Human Takeover / AI Resume switches function instantly under strict tenant isolation.
