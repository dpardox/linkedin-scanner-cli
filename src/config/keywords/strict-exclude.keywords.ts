import { fluentEnglishKeywords } from './fluent-english.keywords';
import { javaKeywords } from './java.keywords';
import { dotnetKeywords } from './dotnet.keywords';
import { CMSKeywords } from './cms.keywords';
import { pythonKeywords } from './python.keywords';
import { reactKeywords } from './react.keywords';
import { USCitizenshipKeywords } from './us-citizenship.keywords';

export const strictExcludeKeywords = [
  ...fluentEnglishKeywords,
  ...dotnetKeywords,
  ...javaKeywords,
  ...pythonKeywords,
  ...reactKeywords,
  ...CMSKeywords,
  ...USCitizenshipKeywords,

  // citizenship
  'Postulación válida solamente para Chile y Perú',
  'remote position for people located in Spain',
  'U.S. Citizen or Green Card holder (no C2C or visa sponsorship)',
  'this role remotely from any EU country',
  'SOLO CANDIDATOS QUE VIVEN EN ESPAÑA',
  'residir en MADRID o alrededores',
  'Indispensable vivir en España',
  'Permiso de trabajo en España',

  // backend
  'Software Engineer in Support',
  'Senior Back-End Engineer',
  'strong backend focus',
  'Backend Focused',

  // practices
  'Practicante de desarrollo',

  // Golang
  'Programming in high-level languages such as Go',
  'Golang, Python, Java',
  'experience with Go',
  'Proficiency in Go',

  //
  'ServiceNow',

  // sap
  'Especialista en SAP',
  'Consultor SAP',
  'SAP Developer',
  'SAP S/4 HANA',
  'lead sap',
  'SAP ABAP',

  // QA
  'Senior QA Automation Engineer',

  // Salesforce
  'experience with Salesforce',

  // Ruby on rails
  'backend development with frameworks like Ruby on Rails',
  'Ruby on Rails Engineer',

  //
  'Shelf Digital Architect',

  //
  'años de experiencia en DMP, CDP',

  // flutter
  'experience in mobile development using Flutter',

  // elixir
  'Backend Engineer working with Elixir',

  // crypto
  'Past experience in building or managing crypto wallets with DeFi features',

  // vue
  'Strong hands-on experience with Vue 3',

  //
  'Administer and optimize Apache Kafka clusters',

  //
  'Experiencia demostrable en FastAPI',

  // PM
  'Project Manager - Sr. Specialist Developer',

  //
  'expert@ en la solución ITSM de Helix',

  //
  '(Prácticas no remuneradas)',

  // Cobol
  'Programador Cobol',

  // Adobe Experience Manager AEM
  'años de experiencia trabajando con Adobe Experience Manager',
  'Adobe Experience Manager (AEM)',
  'Adobe AEM',

  // One Identity Manager
  'One Identity Manager Senior',

  // Cloud
  'years of hands-on AWS experience',
  'CLOUD ENGINEERING',

  // oracle
  'Oracle Developer (Forms y Reports)',

  // medix
  'years of development experience in Medix',

  // mova
  'framework MOVA',

  // c++
  'C++ development skills',
].filter(Boolean);
