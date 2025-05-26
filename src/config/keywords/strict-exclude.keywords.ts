import { fluentEnglishKeywords } from './fluent-english.keywords';
import { javaKeywords } from './java.keywords';
import { dotnetKeywords } from './dotnet.keywords';
import { CMSKeywords } from './cms.keywords';
import { pythonKeywords } from './python.keywords';
import { reactKeywords } from './react.keywords';
import { USCitizenshipKeywords } from './us-citizenship.keywords';
import { spainCitizenshipKeywords } from './spain-citizenship.keywords';
import { golangKeywords } from './golang.keywords';
import { SAPKeywords } from './sap.keywords';

export const strictExcludeKeywords = [
  ...fluentEnglishKeywords,
  ...dotnetKeywords,
  ...SAPKeywords,
  ...javaKeywords,
  ...pythonKeywords,
  ...golangKeywords,
  ...reactKeywords,
  ...CMSKeywords,
  ...USCitizenshipKeywords,
  ...spainCitizenshipKeywords,

  // citizenship
  'Postulación válida solamente para Chile y Perú',
  'this role remotely from any EU country',

  // support
  'Software Engineer in Support',
  'Customer Support Technician',

  // backend
  'Senior Back-End Engineer',
  'strong backend focus',
  'Backend Focused',

  // practices
  'Practicante de desarrollo',

  //
  'ServiceNow',

  // QA
  'Senior QA Automation Engineer',

  // Salesforce
  'experience with Salesforce',
  'Salesforce Developer',

  // Ruby on rails
  'ruby on rails',

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
  'Vue.js UI Lead',
  'Lead VUEJS',

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
  'Desarrollador AEM',
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
  'experienced C++',

  // genexus
  'Desarrollador Genexus',

  // perl
  'Perl Developer',

  // visual foxpro
  'Visual FoxPro',

  // AI
  'Generative AI Engineer',

  // shopify
  'Shopify Developer',

  // electron
  'Electron Developer',

  // bi
  'BI Report Engineer',

  // codeigniter
  'Experto en CodeIgniter',

  // devops
  'DevOps Engineer',

  // sales
  'Sales Representative',

  'la colaboración es una piedra angular',

  // unpaid
  'Voluntary Unpaid',
].filter(Boolean);
