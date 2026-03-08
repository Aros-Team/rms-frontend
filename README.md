# Restaurant Management System (RMS) - Frontend

Version: 0.1.0

Modern, scalable frontend for restaurant operations, built with Angular 21 and designed to work seamlessly with the RMS backend API.

Context
This is the frontend component of the Restaurant Management System (RMS). It provides a responsive web interface for managing orders, products, tables, and more. The frontend communicates with the RMS API to handle real-time restaurant operations.

Technologies We're Using
The RMS Frontend is built on a modern and scalable stack:

- **Framework**: Angular 21 with standalone components and signals
- **UI Library**: PrimeNG 21 for component library
- **Styling**: Tailwind CSS 3 + PrimeNG Tokens for consistent theming
- **Language**: TypeScript 5.9
- **Build**: Angular CLI
- **Testing**: Karma + Jasmine (unit), Puppeteer (E2E)
- **Containerization**: Docker

Requirements
Before running this project, ensure you have installed:

- **Node.js 20.x** - Required for local development
- **Docker** - Required for building production images
- **Taskfile** - To simplify command execution
- **Chromium** - Required for E2E tests (install via your OS package manager)

First steps
Install dependencies:

```bash
npm install
```

Run the project:

```bash
task run
```

Build the project:

```bash
# This command runs tests and then generates a Docker image
task build
```

Run tests only:

```bash
task test
```
