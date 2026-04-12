# RMS Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added
- **Real-time Kitchen Updates**
  - WebSocket integration with STOMP protocol for live order notifications
  - Automatic updates when orders are created, prepared, or ready
  - Multi-client synchronization for kitchen displays
  - Connection status indicator in kitchen UI
  - Automatic reconnection on connection loss
  - Comprehensive documentation for WebSocket implementation

### Changed
- **Kitchen Module**
  - Replaced polling mechanism with WebSocket subscriptions
  - Improved real-time responsiveness
  - Reduced server load by eliminating periodic HTTP requests


## [v0.2.1] - 2026-03-28

### Added
- **Orders**
  - Order notifications system

### Fixed
- Error handling for orders

## [v0.2.0] - 2026-03-20

### Added

- **Orders Management**
  - Create orders
  - List orders with filtering
  - Kitchen view for order preparation
  - Order status lifecycle

- **PrimeNG v21 Migration**
  - Upgraded from PrimeNG v20 to v21
  - Migrated to native CSS animations
  - Updated @primeuix/themes to v2.0.2

- **Theme System**
  - Dynamic color generation from baseColor
  - Production and development theme separation
  - Custom preset using Aura theme

- **UI Components**
  - Dashboard with statistics
  - Products management (CRUD)
  - Categories management
  - Tables management
  - Areas management
  - User management

### Fixed
- Date filtering in orders
- Timezone handling
- API endpoint alignment
- Theme import paths
- Multiple bug fixes

### Removed
- Angular Material (unused)
- Angular CDK (unused)

## [v0.1.0] - 2026-03-19

### Added
- **Authentication**
  - Login with email/password
  - Two-factor authentication (2FA)
  - Password recovery flow (forgot/reset password)
  - Role-based access control (Admin, Worker)
  - Auth guards for protected routes
