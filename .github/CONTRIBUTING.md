# Contributing to Whisper+

First off, thanks for taking the time to contribute!

## Code of Conduct
This project is open source and we want to ensure a welcoming environment for everyone. Please be respectful and considerate in your interactions.

## How Can I Contribute?

### Reporting Bugs
This section guides you through submitting a bug report for Whisper+. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

- **Use a clear and descriptive title** for the issue to identify the problem.
- **Describe the exact steps which reproduce the problem** in as many details as possible.
- **Provide specific examples** to demonstrate the steps.

### Suggesting Enhancements
This section guides you through submitting an enhancement suggestion for Whisper+, including completely new features and minor improvements to existing functionality.

- **Use a clear and descriptive title** for the issue to identify the suggestion.
- **Provide a step-by-step description of the suggested enhancement** in as many details as possible.
- **Explain why this enhancement would be useful** to most Whisper+ users.

## Development Setup

1.  **Fork and Clone**:
    ```bash
    git clone https://github.com/your-username/whisper-plus.git
    cd whisper-plus
    ```

2.  **Dependencies**:
    - Node.js & npm
    - Rust (latest stable)
    - System libs (Linux): `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`.

3.  **Install & Run**:
    ```bash
    npm install
    npm run tauri dev
    ```

## Styleguides

### Git Commit Messages
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less

### TypeScript / Rust
- Ensure no lint errors remain (`npm run build` will fail otherwise).
- Use `snake_case` for Rust and `camelCase` for TypeScript variables/functions.
