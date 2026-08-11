# Xperience by Kentico — Solution Navigation Map

> This reference file is loaded on demand by the xperience-source-validation skill.
> It provides a complete navigational map of the Xperience source code repository.

Repository root: `resources/repositories/xperience`
Solution file: `CMSSolution/CMSSolution.sln`
Git remote: Azure DevOps (`kenticoxperience/CMS/_git/xperience`)
Primary branch: `master`
Target framework: .NET 8.0+

---

## Top-Level Repository Structure

```
xperience/
├── CMSSolution/          # Main .NET solution (~600+ projects)
├── Build/                # Build utilities, API docs, SQL data, NuGet scripts
├── Pipelines/            # Azure DevOps YAML pipelines (30+ files)
├── Preview/              # Preview environment configuration
├── Scripts/              # Utility scripts (ContentSync/)
├── KeyGen/               # Key generation tools
├── docker/               # Docker images (net8/, net9/, net10/, mssql-server-linux/, ui-tests/)
├── infrastructure/       # IaC (Bicep), performance tests, source browser
├── docs/                 # Internal documentation (features/, guides/, testing/, best-practices/)
└── .devops/, .github/    # CI/CD and repo configuration
```

---

## Solution Folder Organization

The solution file groups projects into these logical tiers:

- **Libraries** — Core foundational libraries
- **Platform** — Core platform infrastructure
- **CoreAndData** — Database & core utilities
- **ContentManagement** — Content authoring & management
- **Security** — Authentication, authorization, membership
- **OnlineMarketing** — Marketing automation features
- **BaseModules** — Base module infrastructure
- **MVC** — ASP.NET Core presentation layer
- **Admin** — Admin UI framework
- **Integrations** — Third-party integrations (storage, email, cloud)
- **Tools** — Utility tools and CLI
- **Samples** — Example applications (DancingGoat, Boilerplate)
- **Development** — Internal development tools
- **Analyzers** — Roslyn code analyzers
- **DigitalCommerce** — E-commerce module
- **Aira** — AI/ML component
- **Tests** — All test projects
- **SaaSAndCloud** — Cloud integration services

---

## Core & Foundation

### Core (`CMSSolution/Core/`)
Central application core — services, discovery, IoC container, interfaces.
Subdirectories: `Attributes/`, `Discovery/`, `Factories/`, `Interfaces/`, `IoCContainer/`, `Modules/`, `Services/`

### Base (`CMSSolution/Base/`)
Base classes, extensions, utilities, configuration, handlers.
Subdirectories: `Abstract/`, `Application/`, `Configuration/`, `Containers/`, `Extensions/`, `Handlers/`, `Module/`, `Routing/`, `Threads/`

### DataEngine (`CMSSolution/DataEngine/`)
ORM layer, database abstraction, queries, LINQ providers, SQL data providers.
Subdirectories: `Abstract/`, `Application/`, `Data/`, `Database/`, `Query/`, `Services/`, `LINQ/`

### Helpers (`CMSSolution/Helpers/`)
Shared utility methods — text, media, markup, caching, web farm sync helpers.

### IO (`CMSSolution/IO/`)
File and stream operations.

### Modules (`CMSSolution/Modules/`)
Module registration and lifecycle management.

---

## Content & Websites

### ContentEngine (`CMSSolution/ContentEngine/`)
Headless CMS content items, taxonomies, content types, publishing, versioning.
Subdirectories: `Channel/`, `ContentItem/`, `ContentItemAssets/`, `ContentTypeManagement/`, `Taxonomy/`, `Translation/`, `VisualBuilder/`, `Query/`, `Synchronization/`

### Websites (`CMSSolution/Websites/`)
Website structure, pages, web page builder, routing, channels, domains.
Subdirectories: `Website/`, `WebPage/`, `WebPageContent/`, `PageBuilder/`, `Templates/`, `Routing/`, `Domains/`, `Cache/`

### ContentSynchronization (`CMSSolution/ContentSynchronization/`)
CI/CD for content, continuous integration of content items.

### ContentWorkflowEngine (`CMSSolution/ContentWorkflowEngine/`)
Content publishing workflows and approvals.

### MediaLibrary (`CMSSolution/MediaLibrary/`)
Asset management, media library organization.

---

## Security & Membership

### Membership (`CMSSolution/Membership/`)
User roles, permissions, credentials, authentication.
Subdirectories: `Authentication/`, `Members/`, `Roles/`, `Users/`, `ApplicationPermission/`

### DataProtection (`CMSSolution/DataProtection/`)
Encryption, data security, sensitive data handling.

---

## Forms

### FormEngine (`CMSSolution/FormEngine/`)
Dynamic form builder, form controls, validation.
Subdirectories: `FormControls/`, `FormInfo/`, `Manager/`, `CodeGenerators/`

### OnlineForms (`CMSSolution/OnlineForms/`)
Business forms (BizForms), form submissions.
Subdirectories: `Items/`, `Activities/`, `Automation/`, `SmartFields/`

---

## Email & Messaging

### EmailEngine (`CMSSolution/EmailEngine/`)
Email configuration, templates, rendering.

### EmailMarketing (`CMSSolution/EmailMarketing/`)
Marketing campaigns via email.

### Notifications (`CMSSolution/Notifications/`)
System notifications framework.

---

## Marketing & Automation

### Automation (`CMSSolution/Automation/`)
Marketing automation workflows, actions, triggers.
Subdirectories: `Actions/`, `AutomationEngine/`, `Manager/`, `Triggers/`, `Providers/`

### ContactManagement (`CMSSolution/ContactManagement/`)
Contact/account management, segments, data platform.
Subdirectories: `Contact/`, `ContactGroup/`, `Account/`, `Activities/`, `Automation/`, `Merging/`, `Services/`

### Activities (`CMSSolution/Activities/`)
Activity tracking, user interactions.

### CustomerJourneys (`CMSSolution/CustomerJourneys/`)
Customer journey orchestration.

### OnlineMarketing (`CMSSolution/OnlineMarketing/`)
Legacy marketing features.

---

## Digital Commerce

### Commerce (`CMSSolution/Commerce/`)
E-commerce core — orders, shopping cart, customers, pricing.
Subdirectories: `Customer/`, `Order/`, `OrderItem/`, `ShoppingCart/`, `Promotion/`, `PaymentMethod/`, `ShippingMethod/`, `PriceCalculation/`

### Campaigns (`CMSSolution/Campaigns/`)
Promotional campaigns, customer targeting.

---

## Headless & API

### Headless (`CMSSolution/Headless/`)
GraphQL/REST APIs, headless channel, tokens, queries.
Subdirectories: `HeadlessItem/`, `HeadlessChannel/`, `HeadlessToken/`, `Query/`, `ContinuousIntegration/`

---

## Presentation Layer (MVC)

```
CMSSolution/Mvc/
├── AspNetCore.Platform/                          # Platform services for ASP.NET Core
├── Client/                                       # Client-side assets (JS/TS/CSS)
├── Kentico.Web.Mvc/                              # Core MVC integration
├── Kentico.Content.Web.Mvc/                      # Content delivery for MVC
├── Kentico.AspNetCore.Platform/                  # Platform bootstrapping
├── Kentico.Content.Web.Rcl/                      # Shared Razor components
├── Kentico.VisualBuilderComponents.Rcl/          # Visual builder components
├── Kentico.Membership/                           # MVC membership integration
├── Kentico.OnlineMarketing.Web.Mvc/              # Marketing for MVC
├── Kentico.Xperience.Admin.Base/                 # Admin UI framework base
├── Kentico.Xperience.Admin.DigitalMarketing/     # Admin marketing panels
├── Kentico.Xperience.Admin.Websites/             # Admin website management
├── Kentico.Xperience.Admin.Headless/             # Admin headless management
├── Kentico.Xperience.Admin.DigitalCommerce/      # Admin commerce panels
├── Kentico.Xperience.Headless/                   # MVC headless abstractions
├── Projects/                                     # Sample applications
│   ├── Kentico.Xperience.Boilerplate/            # Starter template
│   ├── Kentico.Xperience.DancingGoat/            # Reference sample site
│   ├── Kentico.Xperience.Performance/            # Performance test app
│   └── Kentico.Xperience.UITests/                # UI test runner
└── Tests/                                        # MVC layer tests
```

---

## Platform Infrastructure

| Module | Location | Purpose |
|---|---|---|
| EventLog | `CMSSolution/EventLog/` | System event logging |
| Scheduler | `CMSSolution/Scheduler/` | Task scheduling |
| MacroEngine | `CMSSolution/MacroEngine/` | Macro language processor |
| Globalization | `CMSSolution/Globalization/` | Localization & culture management |
| WebFarmSync | `CMSSolution/WebFarmSync/` | Multi-server synchronization |
| Routing.Web | `CMSSolution/Routing.Web/` | URL routing |
| ContinuousIntegration | `CMSSolution/ContinuousIntegration/` | CI/CD infrastructure |
| LicenseProvider | `CMSSolution/LicenseProvider/` | Product licensing |
| Workspaces | `CMSSolution/Workspaces/` | Multi-tenant workspace support |
| AIRA | `CMSSolution/AIRA/` | AI-powered features |

---

## Integrations (`CMSSolution/Integrations/`)

| Package | Purpose |
|---|---|
| Kentico.Xperience.AmazonStorage | AWS S3 file storage |
| Kentico.Xperience.AzureStorage | Azure Blob Storage |
| Kentico.Xperience.Cloud | Cloud platform services |
| Kentico.Xperience.ImageProcessing | Image manipulation |
| Kentico.Xperience.SendGrid | SendGrid email service |
| Kentico.Xperience.Mjml | MJML email templates |
| Kentico.Xperience.ManagementApi | Content management API |

---

## Testing

Tests live in `CMSSolution/Tests/` and follow the pattern `{Module}.Tests` / `{Module}.Base.Tests`.

Key test projects:
- Core.Tests, Base.Tests, DataEngine.Tests
- ContentEngine.Tests, ContentEngine.Base.Tests
- Websites.Tests, Websites.Base.Tests
- Headless.Tests, Headless.Base.Tests
- Commerce.Tests, Automation.Tests, ContactManagement.Tests
- FormEngine.Tests, EmailEngine.Tests, OnlineForms.Tests
- FullApp.Tests (integration tests)
- Kentico.Xperience.Core.Tests

---

## Build System

| File | Purpose |
|---|---|
| `Directory.Build.props` | Target framework, assembly signing, static analysis |
| `Directory.Packages.props` | Centralized NuGet package versions (60+ deps) |
| `Build.props` | Assembly signing (CMS.snk), output paths by project type |
| `Admin.props` | Admin project properties |
| `WebApp.props` | Web application properties |
| `Libraries.props` | Library project properties |
| `nugetpackage.props` | NuGet package metadata |

Output directories are organized by project type:
```
Output/{Configuration}/{ProjectType}/net8.0/
├── CoreAndStandard/
├── MVCCore/
├── Admin/
├── Integrations/
├── Analyzers/
└── Development/
```

---

## Key Technology Stack

- **Framework:** .NET 8.0+
- **GraphQL:** HotChocolate 15.x
- **Cloud:** Azure Storage/DataProtection, AWS S3
- **Email:** SendGrid, MailKit, MJML
- **Image Processing:** ImageSharp, Magick.NET
- **Testing:** NUnit, NSubstitute
- **Code Analysis:** Roslyn, SonarAnalyzer, BugHunter
- **API Versioning:** Asp.Versioning.Mvc
