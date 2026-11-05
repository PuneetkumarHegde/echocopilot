import { ProjectRecord, TechChoiceItem, MajorFeatureItem, VerifiedContributionItem } from './profileTypes';
import { sanitizeSourceCode } from './secretSanitizer';

export interface CodeFileInput {
  name: string;
  path: string;
  content: string;
}

export interface AnalysisOutcome {
  project: Partial<ProjectRecord>;
  sanitizedFilesCount: number;
  blockedFilesCount: number;
  warnings: string[];
}

/**
 * Analyzes imported project files to extract architecture clues,
 * database usage, tech choices, and propose verified contributions.
 */
export function analyzeProjectFiles(projectName: string, files: CodeFileInput[]): AnalysisOutcome {
  const warnings: string[] = [];
  let sanitizedCount = 0;
  let blockedCount = 0;

  const detectedTech: Set<string> = new Set();
  const detectedEndpoints: Set<string> = new Set();
  const detectedTables: Set<string> = new Set();
  const detectedFeatures: MajorFeatureItem[] = [];
  const proposedContributions: VerifiedContributionItem[] = [];

  for (const file of files) {
    const sanitization = sanitizeSourceCode(file.content, file.name);
    if (sanitization.isBlockedFile) {
      blockedCount++;
      warnings.push(...sanitization.warnings);
      continue;
    }

    sanitizedCount++;
    if (sanitization.warnings.length > 0) {
      warnings.push(...sanitization.warnings.map(w => `[${file.name}] ${w}`));
    }

    const content = sanitization.sanitized;
    const lowerContent = content.toLowerCase();
    const fileNameLower = file.name.toLowerCase();

    // Detect Languages & Frameworks
    if (fileNameLower.endsWith('.java')) {
      detectedTech.add('Java');
      if (content.includes('@SpringBootApplication') || content.includes('@RestController') || content.includes('org.springframework')) {
        detectedTech.add('Spring Boot');
      }
    }
    if (fileNameLower.endsWith('.ts') || fileNameLower.endsWith('.tsx')) {
      detectedTech.add('TypeScript');
      if (content.includes('next/') || content.includes('next/server') || fileNameLower.includes('app/')) {
        detectedTech.add('Next.js');
      }
      if (content.includes('react') || content.includes('useState') || fileNameLower.endsWith('.tsx')) {
        detectedTech.add('React');
      }
    }
    if (fileNameLower.endsWith('.py')) {
      detectedTech.add('Python');
      if (content.includes('fastapi')) detectedTech.add('FastAPI');
      if (content.includes('django')) detectedTech.add('Django');
      if (content.includes('flask')) detectedTech.add('Flask');
    }
    if (fileNameLower.endsWith('.go')) detectedTech.add('Go');

    // Detect Databases & Caches
    if (lowerContent.includes('postgresql') || lowerContent.includes('pg_') || lowerContent.includes('postgres')) {
      detectedTech.add('PostgreSQL');
    }
    if (lowerContent.includes('mongodb') || lowerContent.includes('mongoose') || lowerContent.includes('pymongo')) {
      detectedTech.add('MongoDB');
    }
    if (lowerContent.includes('redis') || lowerContent.includes('ioredis') || lowerContent.includes('jedis')) {
      detectedTech.add('Redis');
    }
    if (lowerContent.includes('prisma') || lowerContent.includes('@prisma/client')) {
      detectedTech.add('Prisma ORM');
    }

    // Detect API Endpoints
    const restMatches = content.match(/(GET|POST|PUT|PATCH|DELETE)\s+['"`]([^'"`]+)['"`]/gi) ||
      content.match(/@(GetMapping|PostMapping|PutMapping|DeleteMapping)\s*\(\s*["']([^"']+)["']\)/gi) ||
      content.match(/app\.(get|post|put|delete)\s*\(\s*["']([^"']+)["']/gi);

    if (restMatches) {
      restMatches.slice(0, 5).forEach(m => detectedEndpoints.add(m.trim()));
    }

    // Detect Database Tables / Models
    const modelMatches = content.match(/model\s+(\w+)\s+\{/g) ||
      content.match(/@Entity[\s\S]*?class\s+(\w+)/g) ||
      content.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)/gi);

    if (modelMatches) {
      modelMatches.slice(0, 5).forEach(m => detectedTables.add(m.replace(/@Entity|class|model|CREATE TABLE/gi, '').trim()));
    }

    // Propose contributions based on file importance
    if (fileNameLower.includes('auth') || fileNameLower.includes('security') || fileNameLower.includes('jwt')) {
      proposedContributions.push({
        id: `contrib_${Math.random().toString(36).substring(2, 7)}`,
        area: 'Authentication & Security Layer',
        description: `Implementation in ${file.name}: Token validation, session authorization, and security filters.`,
        isPersonallyImplemented: false,
        evidenceCodeFiles: [file.name]
      });
    } else if (fileNameLower.includes('controller') || fileNameLower.includes('route') || fileNameLower.includes('api')) {
      proposedContributions.push({
        id: `contrib_${Math.random().toString(36).substring(2, 7)}`,
        area: 'API Route & Controller Handlers',
        description: `Endpoint orchestration and request/response serialization in ${file.name}.`,
        isPersonallyImplemented: false,
        evidenceCodeFiles: [file.name]
      });
    } else if (fileNameLower.includes('service') || fileNameLower.includes('engine') || fileNameLower.includes('logic')) {
      proposedContributions.push({
        id: `contrib_${Math.random().toString(36).substring(2, 7)}`,
        area: 'Core Business Logic & Service Engine',
        description: `Core domain processing and state transitions in ${file.name}.`,
        isPersonallyImplemented: false,
        evidenceCodeFiles: [file.name]
      });
    }
  }

  // Deduplicate proposed contributions by area
  const uniqueContributions: VerifiedContributionItem[] = [];
  const seenAreas = new Set<string>();
  for (const pc of proposedContributions) {
    if (!seenAreas.has(pc.area)) {
      seenAreas.add(pc.area);
      uniqueContributions.push(pc);
    }
  }

  // Construct Tech Stack list
  const techStack: TechChoiceItem[] = Array.from(detectedTech).map(tech => ({
    name: tech,
    role: tech.includes('SQL') || tech.includes('Mongo') || tech.includes('Redis') ? 'Database' :
          tech.includes('React') || tech.includes('Next') ? 'Frontend' : 'Backend',
    whyChosen: `Selected for ${tech} because of performance, ecosystem maturity, and project scalability requirements.`,
    alternativesConsidered: tech === 'PostgreSQL' ? 'Considered MongoDB, but needed ACID transactions and relational constraints.' :
                           tech === 'Java' ? 'Considered Python, but required high-throughput multithreading and static typing.' : undefined
  }));

  const project: Partial<ProjectRecord> = {
    name: projectName || 'Imported Project',
    tagline: `Engineered using ${Array.from(detectedTech).slice(0, 3).join(', ') || 'modern fullstack technologies'}`,
    problemStatement: '',
    targetUsers: '',
    architecture: detectedTech.has('Next.js') ? 'Full-stack Next.js App Router architecture with serverless route handlers.' :
                  detectedTech.has('Spring Boot') ? 'Layered Microservices Architecture with Controller-Service-Repository separation.' :
                  'Modular client-server architecture.',
    technologyStack: techStack,
    majorFeatures: detectedFeatures.length > 0 ? detectedFeatures : [
      {
        id: 'feat_auto_1',
        name: 'Core Application Service',
        description: 'Handles primary domain logic and client requests.',
        implementationDetails: 'Implemented using modular service components with unit test coverage.'
      }
    ],
    databaseSchemaAndApi: {
      databaseType: detectedTech.has('PostgreSQL') ? 'PostgreSQL Relational DB' :
                    detectedTech.has('MongoDB') ? 'MongoDB Document Store' : 'Embedded / Key-Value',
      majorEntitiesOrTables: Array.from(detectedTables),
      apiDesignPatterns: ['RESTful JSON API'],
      keyEndpoints: Array.from(detectedEndpoints)
    },
    securityAndPerformance: {
      securityMeasures: [
        'Secret Sanitizer verified - zero secrets committed',
        'Input parameter validation and sanitized queries'
      ],
      performanceOptimizations: [
        detectedTech.has('Redis') ? 'Redis caching layer for frequent reads' : 'Indexed primary and foreign keys'
      ]
    },
    verifiedContributions: uniqueContributions.length > 0 ? uniqueContributions : [
      {
        id: 'contrib_1',
        area: 'Full-Stack Architecture & Feature Implementation',
        description: 'Personally wrote end-to-end features and integration tests.',
        isPersonallyImplemented: true
      }
    ],
    challengesAndSolutions: [],
    limitationsAndImprovements: {
      knownLimitations: [],
      whatWouldYouImproveIfRebuilt: 'If rebuilding today, I would improve asynchronous event decoupling and observability tracing.'
    }
  };

  return {
    project,
    sanitizedFilesCount: sanitizedCount,
    blockedFilesCount: blockedCount,
    warnings
  };
}

