import { beforeEach, describe, expect, test } from 'vitest';
import { FrancAdapter } from './franc.adapter';
import { normalize } from '../shared/utils/normalize.util';

describe('FrancAdapter', () => {
  let franc: FrancAdapter;

  beforeEach(() => {
    franc = new FrancAdapter();
  });

  test('should detect "eng" language', () => {
    const text = 'Hello, my name is Donovan and I am currently looking for new job opportunities in the field of software development.';
    const result = franc.detect(text);
    expect(result).toBe('eng');
  });

  test('should detect "spa" language', () => {
    const text = 'Hola, me llamo Donovan y estoy buscando nuevas oportunidades laborales como desarrollador web.';
    const result = franc.detect(text);
    expect(result).toBe('spa');
  });

  test('should detect "spa" language and no "glg"', () => {
    const text = "Buscamos un desarrollador full stack con experiencia e inglés para un proyecto internacional, en el sector bancario.\n\n\n\n\nRequisitos:\n\nExperiencia de 3 a 5 años.\nSpring Boot. Angular (intermedio).\nWebcomponents (intermedio).\nWebFlux u otro framework reactivo (intermedio).\nArquitectura hexagonal (intermedio).\nJavaScript. HTML. TypeScript. CSS.\nJIRA. Mockito. Junit.\nInglés avanzado: B2+ / C1.\n\n\n\n\n¿Qué ofrecemos?\n\nContrato indefinido.\nProyecto estable.\nSalario: entre 30.000 - 34.000 euros brutos anuales.\nOpciones de retribución flexible (seguro médico completo, cheques restaurante).\nTeletrabajo 100%\n\n\n\n\n---\n\nEn Sandav somos unas 200 personas ubicadas en España. Trabajamos con las empresas más importantes a nivel nacional, ayudándolas en todo lo relacionado con las Tecnologías de la Información. Ya sea a través de servicios de outsourcing, consultoría y asistencia técnica, selección de personal, formación, o desarrollo y mantenimiento de software.\n\nwww.sandavteam.com";
    const result = franc.detect(normalize(text));
    expect(result).toBe('spa');
  });

  test('should return empty string for empty text', () => {
    const text = '';
    const result = franc.detect(text);
    expect(result).toBe('und');
  });

});
