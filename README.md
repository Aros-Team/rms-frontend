# Restaurant Management System (RMS)

**Frontend repository**
**Version:** 0.2.1

Robust, scalable frontend application that delivers an intuitive and accessible interface for restaurant operations management, enabling real-time data visualization and seamless user interactions.


## Context

Our first project, ROS, focused exclusively on order management with a basic client interface. While it served its purpose, user experience and accessibility were not a primary concern.

This new platform represents our evolution: a comprehensive Restaurant Management System frontend built around user needs. We're not just displaying data anymore; we're providing an accessible, intuitive experience that empowers every user—from kitchen staff to restaurant managers—with clear interfaces and real-time insights.


## Technologies We're Using

The Aros system frontend is built on a modern and scalable stack, optimized for performance and accessibility:

- **Core Framework:** Angular 20 with standalone components and signals for reactive state management.

- **UI Library:** PrimeNG providing enterprise-grade components with built-in accessibility support.

- **Styling:** Tailwind CSS for utility-first styling, ensuring consistency and maintainability.

- **Real-time Communication:** WebSocket with STOMP protocol for live order updates in the kitchen.


## Features

- **Real-time Kitchen Updates:** WebSocket integration provides instant notifications when orders are created, prepared, or ready for delivery—no page refresh needed.

- **Multi-client Synchronization:** Multiple kitchen displays stay synchronized automatically, ensuring all staff see the same order status.

- **Accessible Interface:** Built with WCAG AA compliance in mind, ensuring usability for all users.

- **Responsive Design:** Optimized for desktop, tablet, and mobile devices.


## Requirements

Before running this project, ensure you have installed:

- [Node.js](https://nodejs.org/) – required for running the application
- [npm](https://www.npmjs.com/) – package manager (comes with Node.js)
- [Taskfile](https://taskfile.dev/) – for running common commands
- [Docker](https://www.docker.com/) – required for build
- [Angular CLI](https://angular.io/cli) – to simplify command execution


## First steps

This project uses [Taskfile](https://taskfile.dev/) for running common commands.

- **Run the project:**
  ```bash
  task run
  ```

- **Build the project:**
  ```bash
  task build
  ```

- **Run tests:**
  ```bash
  task test
  ```

- **Lint and format:**
  ```bash
  task format        # Check and fix formatting
  task format:check  # Check without fixing
  ```


## WebSocket Integration

The kitchen module uses WebSocket for real-time order updates. See the documentation for details:

- [WebSocket Implementation Guide](docs/websocket-implementation.md) - Technical details and architecture
- [WebSocket Usage Examples](docs/websocket-ejemplo-uso.md) - How to use WebSocket in other components
- [WebSocket Summary](docs/websocket-resumen.md) - Quick overview in Spanish

The WebSocket connection is established automatically when accessing the kitchen view, providing instant updates for:
- New orders (QUEUE)
- Orders in preparation (PREPARING)
- Orders ready for delivery (READY)
