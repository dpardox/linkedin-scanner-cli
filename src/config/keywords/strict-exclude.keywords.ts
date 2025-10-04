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
  'Australian Citizen only',
  'Solo Buenos Aires',
  'Europe-based',

  // companies
  'Jobot Consulting',
  'EPAM',
  'CI&T',

  // support
  'Software Engineer in Support',
  'Customer Support Technician',

  // backend
  'Full Stack Developer Backend Focus',
  'Senior Back-End Engineer',
  'Developer Sr. Backend',
  'Desarrollador Backend',
  'strong backend focus',
  'Back End Developer',
  'Backend Developer',
  'Backend Engineer',
  'Backend Focused',

  // practices
  'Buscamos estudiantes avanzados o recién graduados',
  'Practicante de desarrollo',

  //
  'ServiceNow',

  // QA
  'Senior QA Automation Engineer',
  'QA Engineer',

  // Salesforce
  'Strong expertise in Salesforce Sales Cloud',
  'experience with Salesforce',
  'Desarrollador Salesforce',
  'Arquitecto de Salesforce',
  'Salesforce Developer',

  // Ruby on rails
  'Experiencia Desarrollo Ruby',
  'Ruby highly preferred',
  'experience with Ruby',
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
  'Strong hands-on experience with Vue',
  'Indispensable experiencia en VUE',
  'años trabajando con Vue.js',
  'Vue as primary skills',
  'frontend en Vue.js',
  'Programador VueJS',
  'Vue.js UI Lead',
  'Vue Developer',
  'Lead Vue.js',
  'Lead VUEJS',
  'Vue 3',

  //
  'Administer and optimize Apache Kafka clusters',

  //
  'Experiencia demostrable en FastAPI',

  // PM
  'Project Manager - Sr. Specialist Developer',
  'experiencia como Project Manager',

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
  'Oracle Hyperion Planning',

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
  'utilizando herramientas como en Power BI',

  // codeigniter
  'Experto en CodeIgniter',

  // devops
  'DevOps Engineer',

  // sales
  'Sales Representative',

  //
  'la colaboración es una piedra angular',

  // unpaid
  'No habrá un sueldo fijo',
  'Voluntary Unpaid',

  // moodle
  ' Moodle themes',

  // marketing
  'Proficiency in marketing tools',

  // cells
  'Experiencia en desarrollo con Cells',

  //
  'experience with ThingWorx Navigate',

  // rpg
  'experiencia sólida en RPG',

  // appian
  'arquitectura de soluciones Appian',
  'Appian Expertise Required',

  // zapier
  'Experience with Zapier',

  // scrum master
  'Scrum Master',

  // junior
  'Ingeniero de software júnior',
  'Junior Developer',

  // azure
  'Experience working with Azure environment',

  //  jboss
  'basados en JBOSS',
].filter(Boolean);
