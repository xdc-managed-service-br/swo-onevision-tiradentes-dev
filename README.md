# OneVision - AWS Resource Management Platform

OneVision is a comprehensive AWS resource management platform built with Angular 17.3.0 and AWS Amplify Gen 2. It provides a unified interface for monitoring, managing, and analyzing your AWS resources across accounts and regions.

![OneVision Dashboard](https://placeholder.com/dashboard-screenshot.png)

## Features

- **Authentication System**: Secure login, password reset, and new password challenges
- **Comprehensive Dashboard**: Visual representation of resource counts, monitoring status, and distribution metrics
- **Resource Management**:
  - **EC2 Instances**: View instance details, monitoring status, SWO configuration, and auto-scheduling
  - **S3 Buckets**: Track bucket details, lifecycle rules, and storage classes
  - **EBS Volumes**: Monitor volumes, attachments, encryption status, and other properties
  - **RDS Instances**: View database instances, engine types, storage configurations
  - **AMI Snapshots**: Manage Amazon Machine Image snapshots
  - **EBS Snapshots**: Track EBS volume snapshots
- **Data Export**: Export resource data to CSV for further analysis
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

- **Frontend**: Angular 17 with standalone components
- **Backend**: AWS Amplify
  - Authentication: Amazon Cognito
  - Data Storage: AWS AppSync (GraphQL) testestestest
  - Hosting: AWS Amplify Hosting
- **UI Components**: Custom-built Angular components
- **Styling**: CSS/SCSS with responsive design

## Project Structure

```
amplify/
├── auth/
├── data/
src/
├── app/
│   ├── core/                   # Funcionalidades essenciais
│   │   ├── auth/               # Fluxos de autenticação (login, reset de senha)
│   │   │   ├── login/
│   │   │   └── reset-password/
│   │   └── services/           # Serviços reutilizáveis (ex: API clients, helpers)
│   ├── features/               # Módulos de features específicas
│   │   ├── components/         # Componentes de recursos AWS (AMI, EBS, EC2, RDS, S3)
│   │   │   ├── ami-snapshots/
│   │   │   ├── ebs-resources/
│   │   │   ├── ebs-snapshots/
│   │   │   ├── ec2-resources/
│   │   │   ├── rds-resources/
│   │   │   ├── s3-resources/
│   │   │   └── resources/      # Outros recursos genéricos
│   │   └── dashboard/          # Funcionalidades de dashboard
│   │       ├── cloudwatch-monitoring/
│   │       ├── instance-status-widget/
│   │       ├── monitoring-widget/
│   │       ├── resource-analyser/
│   │       └── resource-health/
│   ├── shared/                 # Reutilizáveis entre features
│   │   ├── components/         # Componentes comuns (tabelas, loading, banners)
│   │   │   ├── error-banner/
│   │   │   ├── loading-spinner/
│   │   │   ├── paginated-resource-list/
│   │   │   ├── resource-detail/
│   │   │   ├── resource-list/
│   │   │   ├── resource-table/
│   │   │   ├── resource-tags/
│   │   │   └── websocket-status/
│   │   ├── styles/             # Estilos globais
│   │   └── utils/              # Funções utilitárias (helpers)
│   └── models/                 # Tipos e interfaces TypeScript
├── assets/                     # Assets estáticos (ícones, imagens)
│   └── icons/                  # Ícones SVG ou outros formatos
└── amplify/                    # AWS Amplify config
    ├── auth/                   # Configuração de autenticação
    └── data/                   # Schemas, models de dados
```

## Prerequisites

- Node.js (v16.x or later)
- npm or yarn
- Angular CLI (`npm install -g @angular/cli`)
- AWS Account with appropriate permissions
- AWS Amplify CLI (`npm install -g @aws-amplify/cli`)

## Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-organization/onevision.git
   cd onevision
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Amplify:
   ```bash
   amplify init
   ```
   Follow the prompts to configure your AWS environment.

4. Deploy the backend:
   ```bash
   amplify push
   ```

### Development Server

Run the development server:
```bash
npm start
```

Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Building for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## Deployment

The application can be deployed using AWS Amplify Hosting:

```bash
amplify publish
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- SoftwareOne for sponsoring the development of this platform
- AWS Amplify team for providing a robust backend framework
- Angular team for their excellent web framework