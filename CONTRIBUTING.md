# Contributing Guidelines

Thank you for your interest in contributing to **Stremio Insights**! We welcome contributions to make this watch history and analytics extension even better.

---

## Code of Conduct

By participating, you agree to respect and maintain a safe, welcoming, and collaborative environment. Be respectful, helpful, and constructive.

---

## How to Contribute

### 1. Reporting Bugs
If you find a bug, please open an issue with:
- A clear, descriptive title.
- Steps to reproduce the bug.
- Expected vs. actual behavior.
- Screenshots or console logs if applicable.

### 2. Suggesting Features
If you have an idea for a feature or enhancement:
- Open a feature request issue.
- Describe the core goal and why it would benefit Stremio Insights users.

### 3. Submitting Code Changes

1. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/glowing-new-metric
   ```

2. Make sure you follow our development principles:
   - Run unit tests to prevent regressions:
     ```bash
     pnpm test
     ```
   - Ensure the production build completes cleanly:
     ```bash
     pnpm build
     ```
   - Ensure there are no console warnings or compilation errors.

3. Commit your changes with a descriptive, concise commit message.
4. Push to your branch and submit a Pull Request!
