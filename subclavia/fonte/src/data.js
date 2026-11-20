/* ==========================================================================
   data.js — conteúdo editorial do atlas (window.ATLAS_DATA), pt-BR.
   Revisão editorial: 19/11/2026; ondas 2, 3 e 4 de correções: 20/11/2026. Esquema: CONTENT_SPEC.md.
   Tom (onda 4): o texto descreve e atribui (“Bannon et al. descrevem…”, “nas descrições de ensino…”), sem
   imperativos clínicos dirigidos ao leitor; instruções de uso da interface (“Use…”, “ative…”) são mantidas.
   Regras: números e afirmações de evidência só com fonte verificada no PubMed
   nesta revisão (PMID/DOI em `sources`); fontes do original não reacessadas estão
   marcadas como tal e não sustentam números. Rótulos usam apenas âncoras
   canônicas (SPEC.md §4); o glossário cobre todos os ids canônicos e todos os
   ids registrados pelos módulos 3D (inclusive estruturas acessórias e auxílios).
   Números “no modelo” foram medidos na geometria v2 (src/landmarks.js + módulos montados em Node, sem render)
   em 20/11/2026, onda 3: agulha a 30° do plano coronal; parede da veia ≈3,9 cm após a pele; cateter introduzido
   ≈16 cm; ápice pleural ≈2,4 cm acima do eixo e ≈1,5 cm acima da borda superior do terço medial da clavícula.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- Glossário: utilitários de construção ---------------- */
  const G = {};
  /** Entrada única. */
  function g(id, name, group, desc, relevance) { G[id] = { name, group, desc, relevance }; }
  /** Par bilateral: textos do lado direito e, opcionalmente, do esquerdo (senão, deriva do direito). */
  function bi(base, nameR, nameL, group, desc, relR, relL) {
    g(base + '-R', nameR, group, desc, relR);
    g(base + '-L', nameL, group, desc, relL || 'Estrutura homóloga do lado esquerdo; ' + lowerFirst(relR));
  }
  function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  const ord = (n) => n + 'ª';

  /* ---- Ossos ---- */
  bi('clavicle', 'Clavícula direita', 'Clavícula esquerda', 'Ossos',
    'Osso em “S” entre o manúbrio (articulação esternoclavicular) e o acrômio: a parte medial, mais longa, é convexa para a frente; a lateral, achatada, é côncava.',
    'Marco principal da técnica: a veia subclávia passa logo atrás e abaixo do seu terço medial; ao ultrassom, a clavícula produz sombra acústica.',
    'Do lado esquerdo, o trajeto até a veia cava superior é mais longo e mais suave, e a confluência venosa recebe o ducto torácico.');
  g('manubrium', 'Manúbrio do esterno', 'Ossos',
    'Segmento superior do esterno; sua borda superior forma a incisura jugular e articula-se com as clavículas e com as primeiras cartilagens costais.',
    'A incisura jugular é a referência de direção para a polpa do indicador esquerdo.');
  g('sternum-body', 'Corpo do esterno', 'Ossos',
    'Segmento médio do esterno, articulado às cartilagens da 2ª à 7ª costela.',
    'Atrás dele ficam o pericárdio e o coração; orienta a projeção da veia cava superior e do átrio direito.');
  g('sternal-angle', 'Ângulo do esterno (de Louis)', 'Ossos',
    'Articulação manubrioesternal, palpável como uma crista transversal; nível da 2ª cartilagem costal e, posteriormente, do disco T4/T5.',
    'Bannon et al. o usam como marco externo para estimar o comprimento do cateter (distância da punção ao ângulo, ao longo do trajeto venoso). Fica aproximadamente no plano da carina; a junção cavoatrial está alguns centímetros abaixo — a estimativa não substitui a confirmação por imagem.');
  g('xiphoid', 'Processo xifoide', 'Ossos',
    'Extremidade inferior, cartilaginosa ou ossificada, do esterno.',
    'Fora da região da punção; ajuda na orientação craniocaudal do modelo.');
  for (let i = 1; i <= 12; i++) {
    const tipo = i <= 7 ? 'costela verdadeira (articula-se diretamente com o esterno)' : i <= 10 ? 'costela falsa (cartilagem unida à cartilagem superior)' : 'costela flutuante (sem conexão anterior)';
    if (i === 1) {
      bi('rib-1', '1ª costela direita', '1ª costela esquerda', 'Ossos',
        'Curta, larga, achatada e muito curva. Na face superior, o tubérculo do escaleno anterior (uma pequena crista) separa o sulco da veia subclávia (anterior) do sulco da artéria subclávia (posterior); os dois sulcos e o tubérculo estão modelados na peça.',
        'A veia cruza sua face superior; a costela interpõe osso apenas em parte do trajeto — medialmente, a veia apoia-se diretamente na pleura. Não é escudo contínuo.');
    } else if (i === 2) {
      bi('rib-2', '2ª costela direita', '2ª costela esquerda', 'Ossos',
        'Costela verdadeira cuja cartilagem se articula com o esterno no nível do ângulo do esterno.',
        'Permite contar costelas e espaços intercostais a partir do ângulo do esterno.');
    } else {
      bi('rib-' + i, ord(i) + ' costela direita', ord(i) + ' costela esquerda', 'Ossos',
        ord(i).charAt(0).toUpperCase() + ord(i).slice(1) + ' costela: ' + tipo + '.',
        'Fora do trajeto infraclavicular; incluída para dar forma ao tórax, à pleura e ao pulmão.');
    }
  }
  for (let i = 1; i <= 10; i++) {
    if (i === 1) {
      bi('costal-cartilage-1', '1ª cartilagem costal direita', '1ª cartilagem costal esquerda', 'Ossos',
        'Une a 1ª costela ao manúbrio; junto a ela se fixam o ligamento costoclavicular e a origem do músculo subclávio.',
        'A veia cava superior forma-se atrás da 1ª cartilagem costal direita.',
        'Atrás da 1ª cartilagem costal esquerda passa a veia braquiocefálica esquerda em direção à linha média.');
    } else {
      bi('costal-cartilage-' + i, ord(i) + ' cartilagem costal direita', ord(i) + ' cartilagem costal esquerda', 'Ossos',
        'Cartilagem hialina que prolonga a ' + ord(i) + ' costela em direção ao esterno' + (i >= 8 ? ' (unida à cartilagem superior).' : '.'),
        i === 2 ? 'Articula-se no ângulo do esterno, marco usado para estimar o comprimento do cateter; a junção cavoatrial fica mais abaixo, perto da 3ª cartilagem.' : i === 3 ? 'A veia cava superior chega ao átrio direito aproximadamente na altura da 3ª cartilagem costal direita.' : 'Contorno anterior do tórax; a artéria torácica interna desce atrás das cartilagens.');
    }
  }
  const vertNotes = {
    C4: 'Nível aproximado da bifurcação carotídea; marca a parte alta do recorte do modelo.',
    C5: 'Origem de raízes do plexo braquial (C5) e do frênico (C3–C5).',
    C6: 'O tubérculo anterior de C6 (carótico) é palpável; a artéria vertebral entra no forame transverso de C6.',
    C7: 'Seu processo espinhoso longo é o primeiro bem palpável na base da nuca; a raiz C8 (que emerge entre C7 e T1) forma, com T1, o tronco inferior do plexo braquial.',
    T1: 'A 1ª costela articula-se com T1; o gânglio cervicotorácico (estrelado) fica junto ao colo da 1ª costela.',
    T2: 'No modelo, o disco T2/T3 está no nível da incisura jugular (referência nominal).',
    T3: 'Nível aproximado da formação da veia cava superior no modelo.',
    T4: 'O plano do ângulo do esterno passa aproximadamente pelo disco T4/T5 (arco aórtico, carina).',
    T5: 'O plano do ângulo do esterno passa aproximadamente pelo disco T4/T5 (arco aórtico, carina).',
  };
  ['C4', 'C5', 'C6', 'C7', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'].forEach((v) => {
    g('vertebra-' + v, 'Vértebra ' + v + (v === 'C7' ? ' (vértebra proeminente)' : ''), 'Ossos',
      (v[0] === 'C' ? 'Vértebra cervical' : 'Vértebra torácica') + ' ' + v + '; corpo, arco e processos representados de forma simplificada.',
      vertNotes[v] || 'Referência posterior de nível; sem relação direta com o trajeto da agulha.');
  });
  g('disc', 'Discos intervertebrais', 'Ossos', 'Discos fibrocartilagíneos entre os corpos vertebrais.', 'Usados como referência de nível (p.ex., disco T4/T5 no plano do ângulo do esterno).');
  bi('scapula', 'Escápula direita', 'Escápula esquerda', 'Ossos',
    'Osso plano posterior do ombro; a espinha termina no acrômio e o processo coracoide projeta-se para a frente.',
    'Retração ou protração da escápula mudam a relação clavícula–veia: em cadáveres, leve retração aumentou o contato veia–clavícula e protração afastou a clavícula da veia (Tan et al.).');
  bi('acromion', 'Acrômio direito', 'Acrômio esquerdo', 'Ossos',
    'Extremidade lateral da espinha da escápula, articulada com a clavícula (articulação acromioclavicular).',
    'Limite lateral palpável para dividir a clavícula em terços.');
  bi('coracoid', 'Processo coracoide direito', 'Processo coracoide esquerdo', 'Ossos',
    'Projeção anterior da escápula, palpável abaixo do terço lateral da clavícula, no fundo do sulco deltopeitoral; nele se insere o peitoral menor.',
    'Marca a região em que a veia ainda é axilar — a janela da punção guiada por ultrassom, não a da técnica por marcos.');
  bi('glenoid', 'Cavidade glenoidal direita', 'Cavidade glenoidal esquerda', 'Ossos',
    'Superfície articular rasa da escápula para a cabeça do úmero.',
    'Referência de orientação do ombro; sem relação direta com o trajeto.');
  bi('humerus', 'Úmero direito', 'Úmero esquerdo', 'Ossos',
    'Osso do braço; representado até o terço médio da diáfise.',
    'Posição do braço (aduzido no modelo) altera a cintura escapular e, com ela, a relação clavícula–veia.');
  bi('sc-joint', 'Articulação esternoclavicular direita (com disco articular)', 'Articulação esternoclavicular esquerda (com disco articular)', 'Ossos',
    'Articulação selar entre a extremidade esternal da clavícula, a incisura clavicular do manúbrio e a 1ª cartilagem costal; um disco articular fibrocartilagíneo a divide em dois compartimentos.',
    'Atrás dela a subclávia se une à jugular interna (ângulo venoso) e, à direita, o tronco braquiocefálico se bifurca.',
    'Atrás dela forma-se a veia braquiocefálica esquerda, que recebe o ducto torácico na confluência.');

  /* ---- Veias ---- */
  g('scv-R', 'Veia subclávia direita', 'Veias',
    'Continuação da veia axilar a partir da borda lateral da 1ª costela; cruza a face superior da costela, anterior ao escaleno anterior e atrás do terço medial da clavícula e do subclávio, e termina atrás da articulação esternoclavicular ao unir-se à jugular interna.',
    'Alvo da punção. A adventícia presa ao periósteo, ao ligamento costoclavicular e às fáscias a mantém aberta mesmo em hipovolemia; medialmente, apoia-se na pleura (Bannon et al.).');
  g('scv-L', 'Veia subclávia esquerda', 'Veias',
    'Homóloga da direita; une-se à jugular interna esquerda para formar a veia braquiocefálica esquerda.',
    'Trajeto mais suave até a veia cava superior; a confluência esquerda recebe o ducto torácico.');
  bi('axillary-v', 'Veia axilar direita', 'Veia axilar esquerda', 'Veias',
    'Continua a veia basílica até a borda lateral da 1ª costela; na região infraclavicular fica anterior e inferior à artéria axilar, com os fascículos do plexo ao redor da artéria.',
    'Alvo habitual da punção guiada por ultrassom, lateral à sombra da clavícula; em 50 sujeitos, mais profunda e mais fina à medida que se avança lateralmente (Galloway & Bodenham).');
  bi('ijv', 'Veia jugular interna direita', 'Veia jugular interna esquerda', 'Veias',
    'Desce na bainha carotídea, lateral à carótida comum (vago posterior, entre ambas); dilata-se no bulbo inferior e une-se à subclávia atrás da articulação esternoclavicular.',
    'Destino possível do fio-guia ou do cateter introduzidos pela subclávia direita (mau posicionamento cranial).');
  bi('ejv', 'Veia jugular externa direita', 'Veia jugular externa esquerda', 'Veias',
    'Veia superficial que cruza obliquamente o esternocleidomastóideo e drena na veia subclávia, lateral ao escaleno anterior.',
    'Marco superficial do pescoço; não participa do trajeto infraclavicular.');
  bi('cephalic-v', 'Veia cefálica direita', 'Veia cefálica esquerda', 'Veias',
    'Sobe no sulco deltopeitoral, perfura a fáscia clavipeitoral e drena na veia axilar logo abaixo da clavícula.',
    'Marca o sulco deltopeitoral; pode aparecer na janela ultrassonográfica infraclavicular, onde é possível confundi-la com a veia axilar.');
  g('bcv-R', 'Veia braquiocefálica direita', 'Veias',
    'Curta e quase vertical, da confluência jugulossubclávia direita até a formação da veia cava superior.',
    'A mudança de direção subclávia → braquiocefálica → cava à direita ajuda a explicar maus posicionamentos e a dificuldade com introdutores rígidos (Bannon et al.).');
  g('bcv-L', 'Veia braquiocefálica esquerda', 'Veias',
    'Longa e oblíqua; cruza a linha média atrás do manúbrio, anteriormente aos ramos do arco aórtico, para unir-se à direita.',
    'Pela esquerda, o cateter percorre esse trajeto antes de entrar na cava; ponta alta pode ficar apoiada na parede em ângulo agudo (Stonelake & Bodenham).');
  g('svc', 'Veia cava superior', 'Veias',
    'Formada pela união das braquiocefálicas atrás da 1ª cartilagem costal direita; desce à direita da aorta ascendente até o átrio direito.',
    'Posição descrita para a ponta do cateter: cava distal, próximo à junção cavoatrial, fora do átrio e paralela à parede (Bannon et al.).');
  g('azygos', 'Veia ázigo', 'Veias',
    'Sobe à direita da coluna torácica e arqueia sobre o brônquio principal direito para drenar na face posterior da veia cava superior.',
    'Destino possível de malposição da ponta do cateter; referência na leitura da radiografia.');
  bi('itv', 'Veia torácica interna direita', 'Veia torácica interna esquerda', 'Veias',
    'Acompanha a artéria torácica interna, medialmente a ela — cerca de 1 cm da borda esternal em tomografia (Glassberg et al.) — e drena na veia braquiocefálica.',
    'Relação dos trajetos mediais e profundos; fonte potencial de sangramento.');

  /* ---- Artérias ---- */
  g('aorta', 'Aorta (ascendente, arco e descendente)', 'Artérias',
    'O arco aórtico origina, da direita para a esquerda, o tronco braquiocefálico, a carótida comum esquerda e a subclávia esquerda.',
    'A assimetria dos ramos do arco explica a anatomia arterial diferente à direita e à esquerda.');
  g('bct', 'Tronco braquiocefálico', 'Artérias',
    'Primeiro ramo do arco; sobe à direita da traqueia e se bifurca atrás da articulação esternoclavicular direita em subclávia e carótida comum direitas.',
    'Existe somente à direita; fica atrás da confluência venosa direita.');
  g('cca-R', 'Artéria carótida comum direita', 'Artérias',
    'Nasce do tronco braquiocefálico e sobe na bainha carotídea, medial à jugular interna.',
    'Fora do trajeto infraclavicular; relação crítica na punção da jugular interna.');
  g('cca-L', 'Artéria carótida comum esquerda', 'Artérias',
    'Nasce diretamente do arco aórtico e sobe na bainha carotídea esquerda.',
    'Assimetria: à esquerda não há tronco braquiocefálico.');
  g('sca-R', 'Artéria subclávia direita', 'Artérias',
    'Do tronco braquiocefálico à borda lateral da 1ª costela, dividida pelo escaleno anterior em três partes (1ª medial, 2ª atrás e 3ª lateral ao músculo); arqueia sobre a cúpula pleural.',
    'Posterior ao escaleno anterior: trajetos dirigidos para trás encurtam o caminho até ela. Sob a clavícula, a compressão de um sangramento é difícil.');
  g('sca-L', 'Artéria subclávia esquerda', 'Artérias',
    'Nasce diretamente do arco aórtico e sobe à esquerda da traqueia antes de arquear sobre a cúpula pleural esquerda.',
    'Mesma relação com o escaleno anterior do lado direito; origem diferente.');
  bi('axillary-a', 'Artéria axilar direita', 'Artéria axilar esquerda', 'Artérias',
    'Continuação da subclávia a partir da borda lateral da 1ª costela; cruzada pelo peitoral menor e cercada pelos fascículos do plexo braquial.',
    'Lateralmente à 1ª costela, fica diretamente atrás da veia, sem músculo interposto: trajetos posteriores tornam a punção arterial ainda mais provável (Bannon et al.).');
  bi('vertebral-a', 'Artéria vertebral direita', 'Artéria vertebral esquerda', 'Artérias',
    'Primeiro ramo da 1ª parte da subclávia; sobe para o forame transverso de C6.',
    'Ramo profundo e medial ao trajeto; mostra a densidade de ramos arteriais nesse nível.');
  bi('ita', 'Artéria torácica interna direita', 'Artéria torácica interna esquerda', 'Artérias',
    'Nasce da face inferior da 1ª parte da subclávia e desce atrás das cartilagens costais, lateral à borda do esterno — em média 1,57 ± 0,30 cm à direita em 100 tomografias (Glassberg et al.).',
    'Relação posterior da veia na porção medial do trajeto (Bannon et al.); fonte potencial de sangramento.');
  bi('thyrocervical', 'Tronco tireocervical direito', 'Tronco tireocervical esquerdo', 'Artérias',
    'Ramo da 1ª parte da subclávia, medial ao escaleno anterior; seus ramos cruzam a base do pescoço.',
    'Fora do trajeto ideal; lembra que a 1ª parte da artéria é ramificada e profunda à confluência venosa.');

  /* ---- Músculos e fáscias ---- */
  bi('scm', 'Músculo esternocleidomastóideo direito', 'Músculo esternocleidomastóideo esquerdo', 'Músculos',
    'Cabeça esternal (face anterior do manúbrio) e cabeça clavicular (face superior do terço medial da clavícula) convergem para o processo mastoide.',
    'Entre as duas cabeças fica a fossa supraclavicular menor, sobre a jugular interna e a confluência venosa.');
  bi('scalene-ant', 'Músculo escaleno anterior direito', 'Músculo escaleno anterior esquerdo', 'Músculos',
    'Dos tubérculos anteriores de C3–C6 ao tubérculo do escaleno anterior na 1ª costela; cerca de 1–1,5 cm de espessura (Bannon et al.).',
    'Separa a veia subclávia (anterior) da artéria e do plexo (posteriores); o nervo frênico desce sobre sua face anterior.');
  bi('scalene-mid', 'Músculo escaleno médio direito', 'Músculo escaleno médio esquerdo', 'Músculos',
    'Dos tubérculos posteriores das vértebras cervicais à face superior da 1ª costela, atrás do sulco da artéria subclávia.',
    'Forma, com o escaleno anterior, o intervalo por onde passam a artéria e os troncos do plexo.');
  bi('subclavius', 'Músculo subclávio direito', 'Músculo subclávio esquerdo', 'Músculos',
    'Da junção da 1ª costela com sua cartilagem à face inferior da clavícula; envolvido pela fáscia clavipeitoral.',
    'Ocupa o espaço imediatamente acima e anterior à veia; a agulha o atravessa no trajeto infraclavicular (Bannon et al.).');
  bi('pec-major', 'Músculo peitoral maior direito', 'Músculo peitoral maior esquerdo', 'Músculos',
    'Partes clavicular, esternocostal e abdominal convergindo para o lábio lateral do sulco intertubercular do úmero.',
    'A parte clavicular é atravessada no trajeto; sua espessura pesa na profundidade pele–veia.');
  bi('pec-minor', 'Músculo peitoral menor direito', 'Músculo peitoral menor esquerdo', 'Músculos',
    'Da 3ª à 5ª costela ao processo coracoide; cruza anteriormente a artéria axilar.',
    'Marco profundo na janela ultrassonográfica infraclavicular lateral (veia axilar).');
  bi('deltoid', 'Músculo deltoide direito', 'Músculo deltoide esquerdo', 'Músculos',
    'Origina-se do terço lateral da clavícula, do acrômio e da espinha da escápula; insere-se na tuberosidade deltóidea.',
    'Forma a borda lateral do sulco deltopeitoral.');
  bi('trapezius', 'Músculo trapézio direito', 'Músculo trapézio esquerdo', 'Músculos',
    'Músculo posterior do pescoço e do dorso, inserido no terço lateral da clavícula, no acrômio e na espinha da escápula.',
    'Contorno posterior da base do pescoço; sem relação direta com o trajeto.');
  bi('omohyoid', 'Músculo omo-hióideo direito', 'Músculo omo-hióideo esquerdo', 'Músculos',
    'O ventre inferior cruza a fossa supraclavicular maior, superficial aos escalenos e ao plexo, em direção à escápula.',
    'Marco da base do pescoço; fora do trajeto infraclavicular.');
  bi('costoclavicular-lig', 'Ligamento costoclavicular direito', 'Ligamento costoclavicular esquerdo', 'Músculos',
    'Feixe fibroso curto entre a 1ª costela/cartilagem e a face inferior da extremidade medial da clavícula.',
    'Limite medial do espaço costoclavicular; quando calcificado, pode impedir punções mais mediais (Bannon et al.).');
  bi('clavipectoral-fascia', 'Fáscia clavipeitoral direita', 'Fáscia clavipeitoral esquerda', 'Músculos',
    'Lâmina fascial que envolve o subclávio e o peitoral menor; perfurada pela veia cefálica, pelos vasos toracoacromiais e pelo nervo peitoral lateral.',
    'Plano atravessado logo antes do subclávio e da veia.');
  bi('intercostal', 'Músculos intercostais direitos', 'Músculos intercostais esquerdos', 'Músculos',
    'Camadas externa, interna e íntima que ocupam os espaços intercostais.',
    'Abaixo da 1ª costela a parede é fina: além dela estão a pleura e o pulmão.');

  /* ---- Nervos ---- */
  bi('brachial-plexus', 'Plexo braquial direito', 'Plexo braquial esquerdo', 'Nervos',
    'Raízes C5–T1 emergem entre os escalenos anterior e médio e formam os troncos junto à borda lateral desses músculos, posterossuperiores à artéria subclávia; os fascículos envolvem a artéria axilar.',
    'Lesão direta é improvável, mas o hematoma de uma punção arterial pode causar neuropatia compressiva (Bannon et al.); nas descrições de ensino, parestesia interrompe a punção de imediato.');
  bi('phrenic', 'Nervo frênico direito', 'Nervo frênico esquerdo', 'Nervos',
    'Raízes C3–C5; desce sobre a face anterior do escaleno anterior, passa entre a artéria e a veia subclávias e entra no tórax.',
    'Relação posterior da veia; lesão causa paresia diafragmática ipsilateral (1,5% no grupo por marcos de Fragou et al.).');
  bi('vagus', 'Nervo vago direito', 'Nervo vago esquerdo', 'Nervos',
    'Desce na bainha carotídea, posterior e entre a jugular interna e a carótida comum.',
    'À direita, cruza anteriormente a 1ª parte da artéria subclávia e origina o nervo laríngeo recorrente.',
    'À esquerda, cruza anteriormente o arco aórtico e origina o recorrente esquerdo sob ele.');
  g('recurrent-laryngeal-R', 'Nervo laríngeo recorrente direito', 'Nervos',
    'Origina-se do vago, contorna por baixo e por trás a artéria subclávia direita e sobe no sulco traqueoesofágico.',
    'Profundo e medial ao trajeto; exemplo da assimetria D × E.');
  g('recurrent-laryngeal-L', 'Nervo laríngeo recorrente esquerdo', 'Nervos',
    'Origina-se do vago esquerdo, contorna o arco aórtico junto ao ligamento arterial e sobe no sulco traqueoesofágico.',
    'Assimetria: à esquerda, a alça é torácica (arco aórtico), não cervical.');
  bi('sympathetic-trunk', 'Tronco simpático direito', 'Tronco simpático esquerdo', 'Nervos',
    'Cadeia paravertebral de gânglios unidos por ramos interganglionares.',
    'Estrutura profunda; incluída para orientação das relações posteriores.');
  bi('stellate', 'Gânglio cervicotorácico (estrelado) direito', 'Gânglio cervicotorácico (estrelado) esquerdo', 'Nervos',
    'Fusão do gânglio cervical inferior com o 1º torácico, junto ao colo da 1ª costela, atrás da artéria subclávia e da cúpula pleural.',
    'Lembra o que existe além dos vasos: um trajeto que chegasse a esse plano já teria passado dos vasos subclávios.');

  /* ---- Linfáticos ---- */
  g('thoracic-duct', 'Ducto torácico', 'Linfáticos',
    'Sobe no mediastino posterior entre a veia ázigo e a aorta, à direita da linha média; cruza para a esquerda entre T6 e T4, segue à esquerda do esôfago, arqueia na base do pescoço e termina na confluência venosa esquerda — em revisão sistemática de 1.352 ductos, na jugular interna (≈54%), no ângulo jugulossubclávio (≈26%) ou na subclávia (≈8%) (Bellier et al.).',
    'Lesão pode causar quilotórax ou fístula quilosa — risco concentrado nos acessos à esquerda.');
  g('right-lymphatic-duct', 'Ducto linfático direito', 'Linfáticos',
    'Vaso curto que leva a linfa do quadrante superior direito do corpo à confluência venosa direita.',
    'Por isso o quilotórax é menos esperado na punção à direita.');

  /* ---- Pulmões e pleura ---- */
  g('lung-R-upper', 'Lobo superior do pulmão direito', 'Pulmões e pleura',
    'Inclui o ápice, que se eleva à raiz do pescoço dentro da cúpula pleural, posterior aos vasos subclávios.',
    'O ápice pouco se move com a respiração: é a parte do pulmão em risco no pneumotórax da punção subclávia.');
  g('lung-R-middle', 'Lobo médio do pulmão direito', 'Pulmões e pleura',
    'Situado entre as fissuras horizontal e oblíqua; existe apenas à direita.',
    'Assimetria: pulmão direito com três lobos.');
  g('lung-R-lower', 'Lobo inferior do pulmão direito', 'Pulmões e pleura',
    'Abaixo da fissura oblíqua, apoiado no diafragma.',
    'As bases são as regiões que mais se deslocam na inspiração.');
  g('lung-L-upper', 'Lobo superior do pulmão esquerdo', 'Pulmões e pleura',
    'Inclui o ápice e a língula; a margem anterior apresenta a incisura cardíaca.',
    'O ápice esquerdo tem as mesmas relações com a cúpula e os vasos subclávios.');
  g('lung-L-lower', 'Lobo inferior do pulmão esquerdo', 'Pulmões e pleura',
    'Abaixo da fissura oblíqua esquerda.',
    'Assimetria: pulmão esquerdo com dois lobos.');
  bi('pleura', 'Pleura direita (parietal e cúpula)', 'Pleura esquerda (parietal e cúpula)', 'Pulmões e pleura',
    'Membrana serosa contínua (parietal e visceral) com espaço pleural virtual; a cúpula pleural cobre o ápice e sobe acima da parte anterior da 1ª costela, posterior aos vasos subclávios.',
    'Pneumotórax é a complicação mecânica característica da via subclávia: 1,5% com drenagem no ECR 3SITES (0,5% pela jugular).');
  bi('suprapleural-membrane', 'Membrana suprapleural (fáscia de Sibson) direita', 'Membrana suprapleural (fáscia de Sibson) esquerda', 'Pulmões e pleura',
    'Lâmina fibrosa em tenda sobre a cúpula pleural, da borda interna da 1ª costela ao processo transverso de C7; fica sob a artéria subclávia e o tronco inferior do plexo braquial.',
    'Reforça a cúpula contra as variações de pressão intratorácica, mas é fina: não protege a pleura de uma agulha dirigida para trás ou para baixo.');

  /* ---- Mediastino ---- */
  g('trachea', 'Traqueia', 'Mediastino',
    'Tubo cartilagíneo mediano que se bifurca na carina, aproximadamente no plano do ângulo do esterno.',
    'A carina é referência radiográfica para a ponta do cateter (Stonelake & Bodenham).');
  g('bronchus-R', 'Brônquio principal direito', 'Mediastino',
    'Mais curto, largo e vertical que o esquerdo; a veia ázigo arqueia sobre ele.',
    'O ângulo traqueobrônquico direito é referência radiográfica: segundo dados citados por Bannon et al., fica ao menos 2,9 cm acima da junção cavoatrial.');
  g('bronchus-L', 'Brônquio principal esquerdo', 'Mediastino',
    'Mais longo e horizontal; passa sob o arco aórtico.',
    'Referência de orientação na radiografia de tórax.');
  g('esophagus', 'Esôfago', 'Mediastino',
    'Posterior à traqueia, ligeiramente à esquerda na base do pescoço. O ducto torácico sobe atrás dele, à direita, e passa à sua esquerda depois de cruzar a linha média (T6–T4).',
    'Profundo; sem relação direta com o trajeto infraclavicular.');
  g('heart', 'Coração', 'Mediastino',
    'O átrio direito recebe a veia cava superior; o coração ocupa o mediastino médio, desviado para a esquerda.',
    'Fio-guia que alcança átrio ou ventrículo provoca arritmias; a posição descrita para a ponta do cateter é fora do átrio (Bannon et al.).');
  g('pericardium', 'Pericárdio', 'Mediastino',
    'Saco fibrosseroso que envolve o coração e a porção terminal da veia cava superior.',
    'Perfuração com tamponamento é rara e grave (0,5% no grupo por marcos de Fragou et al.).');
  g('diaphragm', 'Diafragma', 'Músculos',
    'Músculo em cúpula que separa tórax e abdome; inervado pelos frênicos.',
    'Desce na inspiração, deslocando sobretudo as bases pulmonares — o ápice pouco se move.');
  g('thymus', 'Timo (remanescente)', 'Mediastino',
    'Atrás do manúbrio, à frente da veia braquiocefálica esquerda; no adulto é sobretudo tecido adiposo.',
    'Ocupa o mediastino superior anterior; sem relação com o trajeto.');

  /* ---- Pele e superfície ---- */
  g('skin', 'Pele', 'Pele e superfície',
    'Epiderme e derme; marcos palpáveis (incisura jugular, clavícula, ângulo do esterno, coracoide) são lidos através dela.',
    'Marcos de superfície orientam a direção e a região de entrada, mas não localizam a veia nem a ponta da agulha.');
  g('subcutaneous', 'Tela subcutânea', 'Pele e superfície',
    'Camada adiposa entre a derme e a fáscia muscular.',
    'Espessura muito variável: principal fonte de variação da profundidade pele–veia.');
  g('skin-prep', 'Área de antissepsia', 'Pele e superfície',
    'Região preparada com antisséptico antes da colocação dos campos.',
    'Bannon et al. descrevem clorexidina sobre toda a área exposta, com os marcos ainda visíveis e palpáveis depois da colocação dos campos.');
  g('drape', 'Campo estéril', 'Pele e superfície',
    'Campo fenestrado que cobre o paciente da cabeça aos pés, deixando exposta a região da punção.',
    'Barreira estéril máxima (gorro, máscara, avental, luvas, campo amplo) reduz infecção relacionada ao cateter (Bannon et al.).');

  /* ---- Instrumentos ---- */
  g('operator-hand', 'Mão esquerda do operador (com luva)', 'Instrumentos',
    'Mão de apoio de um operador destro: polpa do indicador na incisura jugular, polpa do polegar em apoio infraclavicular, demais dedos fletidos. No modelo, sai de cena a partir da passagem do fio-guia, para expor canhão e fio; na fixação, aparece só um dedo apoiando o canhão durante os nós.',
    'Indicador = referência de direção; polegar = pressão suave que ajuda a manter o conjunto no plano coronal, rente sob a clavícula. Nenhum dos dois mede profundidade. Depois do refluxo, na prática, a mão estabiliza o canhão apoiada no paciente.');
  g('needle', 'Agulha introdutora (18G, parede fina)', 'Instrumentos',
    'Agulha de parede fina acoplada à seringa, avançada sob aspiração suave com o bisel voltado para cima; no modelo, antes da passagem do fio ela gira para que o bisel fique voltado para os pés.',
    'Controla-se a direção (plano frontal) e a inclinação (lida pela cabeceira, em plano quase axial); a posição da ponta não é dada pelos marcos externos.');
  g('syringe', 'Seringa', 'Instrumentos',
    'Seringa acoplada à agulha para aspiração durante o avanço.',
    'Levantar a seringa da parede angula a ponta para trás, mais profunda; por isso Bannon et al. descrevem o conjunto o mais paralelo possível ao plano coronal, rente sob a clavícula.');
  g('guidewire', 'Fio-guia (ponta em J)', 'Instrumentos',
    'Fio metálico flexível introduzido pela agulha (técnica de Seldinger).',
    'Na descrição de ensino, avança sem força, e resistência ou arritmia interrompem a passagem. À direita, pode desviar para a jugular interna; num ECR pela subclávia direita, a ponta em J voltada caudalmente reduziu esse desvio (Tripathi et al.).');
  g('catheter', 'Cateter venoso central (triplo lúmen)', 'Instrumentos',
    'Cateter de três vias (distal, medial e proximal) introduzido sobre o fio após a dilatação do trajeto, com marcas de comprimento em centímetros contadas a partir da ponta e canhão com asas para fixação.',
    'Ponta na veia cava superior distal/junção cavoatrial, confirmada por imagem antes do uso. A marca junto à pele indica quanto foi introduzido — no modelo, ≈16 cm —; anotada, permite reconhecer migração do cateter nas avaliações seguintes.');

  /* ---------------- Estruturas acessórias registradas pelos módulos 3D ----------------
     Fora do trajeto da punção, mas clicáveis no modelo: cada uma tem entrada própria (nome, descrição e
     “Na punção”), para que o cartão e a busca do glossário não fiquem vazios. */
  const FORA = 'Fora do trajeto infraclavicular; incluída para completar a anatomia do modelo.';
  /* Artérias */
  bi('superior-epigastric-a', 'Artéria epigástrica superior direita', 'Artéria epigástrica superior esquerda', 'Artérias',
    'Ramo terminal medial da artéria torácica interna, no 6º espaço intercostal; desce atrás das cartilagens costais inferiores e entra na bainha do músculo reto do abdome.',
    'Fora do trajeto; mostra a continuação da torácica interna, que desce atrás das cartilagens, lateral ao esterno.');
  bi('musculophrenic-a', 'Artéria musculofrênica direita', 'Artéria musculofrênica esquerda', 'Artérias',
    'Ramo terminal lateral da artéria torácica interna, no 6º espaço intercostal; acompanha a margem costal por trás das cartilagens.',
    'Fora do trajeto; mostra a continuação da torácica interna, que desce atrás das cartilagens, lateral ao esterno.');
  bi('inferior-thyroid-a', 'Artéria tireóidea inferior direita', 'Artéria tireóidea inferior esquerda', 'Artérias',
    'Ramo do tronco tireocervical; sobe junto à borda medial do escaleno anterior, faz uma alça medial atrás da bainha carotídea e alcança o polo inferior da tireoide, em relação com o nervo laríngeo recorrente.',
    'Medial e profunda ao trajeto; ilustra quantos ramos arteriais nascem junto à 1ª parte da subclávia.');
  bi('suprascapular-a', 'Artéria supraescapular direita', 'Artéria supraescapular esquerda', 'Artérias',
    'Ramo do tronco tireocervical (às vezes da própria subclávia); cruza à frente do escaleno anterior e do frênico, depois da 3ª parte da subclávia e do plexo, e segue atrás e paralela à clavícula até a incisura da escápula.',
    'Corre atrás da clavícula, acima e atrás da veia: o espaço retroclavicular contém outros vasos além da subclávia.');
  bi('transverse-cervical-a', 'Artéria cervical transversa direita', 'Artéria cervical transversa esquerda', 'Artérias',
    'Ramo do tronco tireocervical; cruza à frente do escaleno anterior e do frênico, pouco acima da clavícula, passa sobre o plexo braquial e segue para o trapézio.',
    'Ramo supraclavicular, fora do trajeto infraclavicular; referência da fossa supraclavicular maior.');
  bi('thoracoacromial', 'Tronco toracoacromial direito', 'Tronco toracoacromial esquerdo', 'Artérias',
    'Ramo curto da 2ª parte da artéria axilar, na borda superior do peitoral menor; perfura a fáscia clavipeitoral e divide-se em ramos peitoral, deltóideo, acromial e clavicular.',
    'Perfura a fáscia clavipeitoral — o mesmo plano que a agulha atravessa —, porém mais lateralmente, junto à veia cefálica; aparece na janela ultrassonográfica infraclavicular lateral.');
  bi('costocervical', 'Tronco costocervical direito', 'Tronco costocervical esquerdo', 'Artérias',
    'Ramo da face posterior da subclávia — à direita, da 2ª parte, atrás do escaleno anterior; à esquerda, da 1ª parte —; arqueia para trás sobre a cúpula pleural até o colo da 1ª costela e divide-se nas artérias intercostal suprema e cervical profunda.',
    'Profundo, sobre a cúpula pleural: mais um vaso no plano que um trajeto dirigido para trás alcançaria.');
  bi('supreme-intercostal-a', 'Artéria intercostal suprema direita', 'Artéria intercostal suprema esquerda', 'Artérias',
    'Ramo do tronco costocervical; desce atrás da pleura, à frente dos colos da 1ª e da 2ª costelas, e origina as artérias intercostais posteriores dos dois primeiros espaços.',
    'Profunda e posterior, junto ao gânglio estrelado; fora do trajeto.');
  bi('deep-cervical-a', 'Artéria cervical profunda direita', 'Artéria cervical profunda esquerda', 'Artérias',
    'Ramo do tronco costocervical; passa para trás entre o processo transverso de C7 e o colo da 1ª costela e sobe na nuca, anastomosando-se com as artérias occipital e vertebral.',
    'Fora do trajeto; completa os ramos da subclávia representados no modelo.');
  g('coronary-rca', 'Artéria coronária direita', 'Artérias',
    'Nasce do seio aórtico direito e percorre o sulco coronário direito, entre o átrio e o ventrículo direitos.', FORA);
  g('coronary-lad', 'Ramo interventricular anterior (descendente anterior)', 'Artérias',
    'Ramo da artéria coronária esquerda que desce no sulco interventricular anterior em direção ao ápice do coração.', FORA);
  g('coronary-lcx', 'Ramo circunflexo', 'Artérias',
    'Ramo da artéria coronária esquerda que contorna o sulco coronário esquerdo até a face posterior do coração.', FORA);
  g('pulmonary-trunk', 'Tronco pulmonar', 'Artérias',
    'Sai do ventrículo direito, à frente e à esquerda da aorta ascendente, e bifurca-se na concavidade do arco aórtico nas artérias pulmonares direita e esquerda.',
    'Fora do trajeto; lembra o que existe além do átrio direito — a posição descrita para a ponta do cateter é na cava, fora do coração.');
  g('pulmonary-a-R', 'Artéria pulmonar direita', 'Artérias',
    'Passa horizontalmente atrás da aorta ascendente e da veia cava superior, à frente do brônquio principal direito, até o hilo do pulmão direito.',
    'Relação posterior da veia cava superior; ajuda a ler o mediastino na radiografia de controle.');
  g('pulmonary-a-L', 'Artéria pulmonar esquerda', 'Artérias',
    'Arqueia sobre o brônquio principal esquerdo, à frente da aorta descendente; une-se à face inferior do arco aórtico pelo ligamento arterial.', FORA);
  g('ligamentum-arteriosum', 'Ligamento arterial', 'Artérias',
    'Remanescente fibroso do ducto arterial fetal, entre a origem da artéria pulmonar esquerda e a face inferior do arco aórtico.',
    'O nervo laríngeo recorrente esquerdo contorna o arco junto a ele — base da assimetria entre os recorrentes direito e esquerdo.');
  /* Veias */
  g('pulmonary-v-RS', 'Veia pulmonar superior direita', 'Veias',
    'Leva sangue oxigenado do pulmão direito ao átrio esquerdo; por isso aparece em vermelho (convenção de cores do atlas). Passa atrás da veia cava superior.',
    'Fora do trajeto; vizinha posterior da cava superior, onde fica a ponta do cateter.');
  g('pulmonary-v-RI', 'Veia pulmonar inferior direita', 'Veias',
    'Leva sangue oxigenado do lobo inferior direito ao átrio esquerdo; aparece em vermelho pela convenção de cores do atlas.', FORA);
  g('pulmonary-v-LS', 'Veia pulmonar superior esquerda', 'Veias',
    'Leva sangue oxigenado do lobo superior esquerdo ao átrio esquerdo; aparece em vermelho pela convenção de cores do atlas.', FORA);
  g('pulmonary-v-LI', 'Veia pulmonar inferior esquerda', 'Veias',
    'Leva sangue oxigenado do lobo inferior esquerdo ao átrio esquerdo; aparece em vermelho pela convenção de cores do atlas.', FORA);
  g('ivc', 'Veia cava inferior (segmento terminal)', 'Veias',
    'Atravessa o centro tendíneo do diafragma (forame da veia cava, nível de T8) e desemboca no átrio direito.',
    'Fio-guia introduzido além do necessário pode atravessar o átrio direito em direção a ela; o fio que alcança o coração provoca arritmias (Lee et al.).');
  /* Mediastino */
  g('carina', 'Carina da traqueia', 'Mediastino',
    'Crista na bifurcação da traqueia em brônquios principais, aproximadamente no plano do ângulo do esterno (disco T4/T5).',
    'Referência radiográfica da ponta do cateter: ponta acima da carina costuma estar fora do átrio; à direita, 74 de 163 pontas ficaram abaixo dela e só 4 de 163 em ângulo agudo com a parede (Stonelake & Bodenham).');
  g('bronchus-RUL', 'Brônquio lobar superior direito', 'Mediastino',
    'Nasce do brônquio principal direito acima da artéria pulmonar direita (brônquio “eparterial”) e ventila o lobo superior.', FORA);
  g('bronchus-RI', 'Brônquio intermédio', 'Mediastino',
    'Continuação do brônquio principal direito depois da saída do lobar superior; dá origem aos brônquios dos lobos médio e inferior.', FORA);
  g('bronchus-RML', 'Brônquio lobar médio', 'Mediastino',
    'Nasce da face anterior do brônquio intermédio e ventila o lobo médio, que só existe à direita.', FORA);
  g('bronchus-RLL', 'Brônquio lobar inferior direito', 'Mediastino',
    'Continuação do brônquio intermédio para o lobo inferior direito.', FORA);
  g('bronchus-LUL', 'Brônquio lobar superior esquerdo', 'Mediastino',
    'Ventila o lobo superior esquerdo, incluindo a língula.', FORA);
  g('bronchus-LLL', 'Brônquio lobar inferior esquerdo', 'Mediastino',
    'Continuação do brônquio principal esquerdo para o lobo inferior esquerdo.', FORA);
  /* Músculos */
  bi('sternohyoid', 'Músculo esterno-hióideo direito', 'Músculo esterno-hióideo esquerdo', 'Músculos',
    'Músculo infra-hióideo fino que nasce da face posterior do manúbrio e da extremidade medial da clavícula e sobe ao osso hioide.',
    'Com o esternotireóideo, separa a face posterior do manúbrio das veias braquiocefálicas; fica medial ao trajeto.');
  bi('sternothyroid', 'Músculo esternotireóideo direito', 'Músculo esternotireóideo esquerdo', 'Músculos',
    'Profundo ao esterno-hióideo; vai da face posterior do manúbrio (nível da 1ª cartilagem costal) à linha oblíqua da cartilagem tireóidea.',
    'Encosta na face anterior das veias braquiocefálicas, atrás do manúbrio; medial ao trajeto.');
  bi('serratus-anterior', 'Músculo serrátil anterior direito', 'Músculo serrátil anterior esquerdo', 'Músculos',
    'Digitações das oito ou nove costelas superiores que se inserem na face costal da margem medial da escápula, passando profundamente a ela; forma a parede medial da axila.',
    'Fora do trajeto; dá forma à parede lateral do tórax e à axila.');
  bi('supraspinatus', 'Músculo supraespinal direito', 'Músculo supraespinal esquerdo', 'Músculos',
    'Manguito rotador: da fossa supraespinal, sob o acrômio e sobre a articulação do ombro, ao tubérculo maior do úmero.',
    'Fora do trajeto; integra o ombro, cuja posição muda a relação clavícula–veia.');
  bi('infraspinatus', 'Músculo infraespinal direito', 'Músculo infraespinal esquerdo', 'Músculos',
    'Manguito rotador: da fossa infraespinal ao tubérculo maior do úmero; rotador lateral do braço.',
    'Fora do trajeto; integra o ombro, cuja posição muda a relação clavícula–veia.');
  bi('teres-minor', 'Músculo redondo menor direito', 'Músculo redondo menor esquerdo', 'Músculos',
    'Manguito rotador: da margem lateral da escápula ao tubérculo maior do úmero, abaixo do infraespinal; rotador lateral.',
    'Fora do trajeto; integra o ombro, cuja posição muda a relação clavícula–veia.');
  g('nuchal-ligament', 'Ligamento nucal', 'Músculos',
    'Septo fibroso mediano da nuca, das pontas dos processos espinhosos cervicais à protuberância occipital externa; origem da parte descendente do trapézio. Abaixo dele, o processo espinhoso de C7 (vértebra proeminente) é o primeiro bem palpável.',
    'Fora do trajeto; completa o contorno posterior do pescoço no modelo.');
  /* Linfáticos */
  bi('supraclavicular-nodes', 'Linfonodos supraclaviculares direitos', 'Linfonodos supraclaviculares esquerdos', 'Linfáticos',
    'Linfonodos cervicais profundos inferiores, ao longo da jugular interna e da artéria cervical transversa, na fossa supraclavicular.',
    'Fora do trajeto infraclavicular; referência da fossa supraclavicular.',
    'Fora do trajeto; à esquerda, junto à terminação do ducto torácico, fica o linfonodo de Virchow.');
  /* Pele e superfície */
  g('dermis', 'Derme', 'Pele e superfície',
    'Camada de tecido conjuntivo denso sob a epiderme, com vasos e terminações nervosas.',
    'Plano do botão anestésico e o primeiro a resistir à agulha; é também onde se ancoram os pontos de fixação do cateter.');
  g('section-deep', 'Plano profundo (superfície de corte)', 'Pele e superfície',
    'Superfície de corte didática que fecha os tecidos profundos no limite do modelo; não é estrutura anatômica.',
    'Sem significado anatômico: indica apenas onde o modelo termina.');
  bi('nipple', 'Papila mamária direita', 'Papila mamária esquerda', 'Pele e superfície',
    'No homem, situa-se em geral no 4º espaço intercostal, perto da linha medioclavicular; a posição varia.',
    'Marco de superfície variável: não serve de referência para a punção.');
  /* Instrumentos e auxílios didáticos */
  g('roll-interscapular', 'Coxim interescapular (rolo entre as escápulas)', 'Instrumentos',
    'Rolo longitudinal sob a coluna torácica, entre as escápulas, que deixa os ombros caírem para trás.',
    'Não equivale ao rolo sob o ombro: ombros retraídos distorceram a veia (Jesseph et al.) e Bannon et al. descrevem compressão da veia entre clavícula e 1ª costela com rolo interescapular. Não “abre espaço” de forma previsível.');
  g('roll-shoulder-R', 'Coxim sob o ombro direito', 'Instrumentos',
    'Rolo pequeno sob o ombro do lado da punção.',
    'Posição diferente do rolo interescapular, não equivalente a ele. Como a posição do ombro muda a relação clavícula–veia (Kitagawa et al.; Tan et al.), marcos palpados antes do coxim — e a janela ultrassonográfica, se disponível — podem não valer depois dele.');
  g('aspirated-blood', 'Sangue aspirado (refluxo)', 'Instrumentos',
    'Sangue que reflui para a seringa quando a ponta da agulha entra na luz de um vaso.',
    'Refluxo escuro e não pulsátil sugere, mas não confirma, posição venosa; Ezaru et al. descrevem a confirmação por método objetivo (manometria) antes de dilatar.');
  g('guidewire-ijv', 'Fio-guia — trajeto alternativo (anômalo) para a jugular interna', 'Instrumentos',
    'Trajeto didático do fio que, na confluência direita, sobe pela jugular interna em vez de descer para a braquiocefálica e a cava.',
    'Mau posicionamento clássico pela subclávia direita; num ECR, a ponta em J dirigida caudalmente reduziu esse desvio (Tripathi et al.). A posição final só é conhecida com imagem.');
  g('dilator', 'Dilatador (sobre o fio-guia)', 'Instrumentos',
    'Dilatador rígido e calibroso introduzido sobre o fio-guia para alargar pele, tela subcutânea e parede venosa antes da passagem do cateter. No modelo, para com a ponta cerca de 2 mm além da parede anterior da veia, ≈4 cm após a pele.',
    'Bannon et al. descrevem avançá-lo só até a profundidade em que a agulha alcançou a veia — no máximo milímetros dentro dela —, porque à direita a curva subclávia → cava favorece a perfuração por um dilatador introduzido fundo.');
  g('dilator-limit', 'Limite do dilatador (parede da veia)', 'Instrumentos',
    'Anel dourado que marca, em torno do fio, a profundidade em que a agulha alcançou a veia.',
    'Segundo Bannon et al., o dilatador não precisa passar mais que milímetros além dela.');
  g('landmark-notch', 'Marcador da incisura jugular', 'Instrumentos',
    'Anel dourado sobre a pele da incisura jugular, onde repousa a polpa do indicador esquerdo.',
    'Referência de direção no plano frontal; não indica profundidade.');
  g('landmark-entry', 'Marcador da região de entrada', 'Instrumentos',
    'Anel dourado sobre a região ilustrativa de entrada do modelo, cerca de 1 cm abaixo da borda inferior da clavícula e lateral à junção dos terços medial e médio.',
    'Região didática, não coordenada clínica: no paciente, a entrada se define pelos marcos dele (capítulo “Entrada”).');
  g('needle-direction', 'Linha-guia de direção', 'Instrumentos',
    'Linha tracejada sobre a pele, da entrada rumo à incisura jugular, na projeção frontal.',
    'Mostra apenas a direção no plano frontal; a inclinação se lê pela cabeceira.');
  g('coronal-plane', 'Plano coronal de referência', 'Instrumentos',
    'Plano frontal translúcido que passa pelo ponto de entrada.',
    'Referência para ler a inclinação: Bannon et al. descrevem o conjunto agulha–seringa o mais paralelo possível a ele, rente sob a clavícula.');
  g('needle-angle', 'Ângulo nominal da agulha com o plano coronal', 'Instrumentos',
    'Arco dourado que mede a inclinação da reta pele → veia do modelo em relação ao plano coronal (≈30°).',
    'Valor geométrico do modelo, não alvo nem margem: a agulha rígida não simula a depressão dos tecidos pelo polegar nem o achatamento do conjunto depois da pele.');
  g('thumb-vector', 'Seta do polegar (pressão suave)', 'Instrumentos',
    'Seta que indica a direção do apoio do polegar esquerdo, para trás e para baixo, sem quantificar força.',
    'O polegar ajuda a manter o conjunto rente sob a clavícula; não é batente, alavanca nem medida de profundidade.');
  /* Fixação: a tesoura de fio é registrada pelo módulo 'fixation'; as demais peças têm entrada em data.fixacao.js
     (que, carregado depois, prevalece se também definir esta) */
  g('tissue-forceps', 'Pinça de dissecção com dente (tipo Adson)', 'Instrumentos',
    'Pinça delicada com dentes na ponta, segura na mão não dominante como um lápis.',
    'Na fixação, faz a contrapressão na pele junto à entrada e estabiliza a pele além da saída da agulha (sem prender a ponta, que se cegaria) e manipula as pontas do fio — na técnica descrita, a agulha não é tocada com os dedos.');
  g('suture-scissors', 'Tesoura de fio', 'Instrumentos',
    'Tesoura de ponta romba usada para cortar o fio da sutura.',
    'Na bailarina, corta as pontas deixando cerca de 0,5–1 cm além do nó final, com as lâminas afastadas do cateter e das extensões — um corte rente demais solta o nó; um corte junto ao cateter pode lesá-lo.');

  /* ---------------- Cenas: estado padrão (evita “vazamento” entre capítulos) ---------------- */
  // dilator: instruments mostra o dilatador com state.dilator (fase ≥ 4,5; a interface usa fase 5 + dilator) ou na
  // subfase 5,25–5,75; explícito em todas as cenas para que nenhuma herde o dilatador da anterior
  const S = (o) => Object.assign({ phase: 0, handPose: 1, breath: 0, rollMode: 'none', wireMal: false, showPlanes: false, fixStep: 0, dilator: false }, o || {});

  window.ATLAS_DATA = {
    meta: {
      title: 'Punção da subclávia direita',
      subtitle: 'Atlas 3D da abordagem infraclavicular por marcos — anatomia em camadas, mão de apoio, planos da agulha, pleura, complicações e ultrassom',
      version: '2.0',
      reviewDate: '20/11/2026',
      disclaimer: 'Material exclusivamente educacional, para profissionais em formação e simulação supervisionada. O modelo 3D é sintético e sem escala clínica: não substitui avaliação do paciente, imagem, supervisão nem protocolos institucionais, e não constitui recomendação assistencial individualizada.',
      basedOn: 'Adaptado do documento-base “Punção da subclávia direita — guia técnico” (DOCX do autor), revisado criticamente e ampliado com literatura verificada no PubMed em 19/11/2026.',
      modelNote: 'Geometria procedural de um adulto masculino nominal (~175 cm), supino, braços aduzidos, construída para este atlas sem segmentação de exames. Cores são convenções de atlas (veias azuis, artérias vermelhas, nervos amarelos, linfáticos verdes); nervos, fáscias e pleura foram engrossados para leitura; variações anatômicas e diferenças de biotipo não estão representadas. Distâncias do modelo são nominais, não medidas.'
    },

    chapters: [
      /* ---------------------------------------------------------------- 01 */
      {
        id: 'marcos', n: '01', short: 'Marcos',
        title: 'Marcos de superfície: o que se palpa e o que fica oculto',
        focus: 'Marcos externos orientam a direção e a região de entrada; não localizam a veia, a ponta da agulha nem a pleura.',
        body: [
          'Na vista anterior, o lado <strong>direito do paciente</strong> aparece à esquerda da tela. A leitura dos marcos parte da <strong>incisura jugular</strong> — borda superior do manúbrio, entre as extremidades esternais das clavículas — e segue a <strong>clavícula</strong> lateralmente até o acrômio. Dividida a clavícula em terços, a <strong>junção dos terços medial e médio</strong> é a referência mais usada na abordagem infraclavicular, e a punção cutânea descrita fica 1–2 cm inferior e lateral a ela (Bannon et al.).',
          'A forma em “S” da clavícula é fonte de confusão. Bannon et al. e o documento-base chamam o marco de “quebra” ou “curva” da clavícula e o situam na junção do terço medial com os dois terços laterais, onde a convexidade anterior medial daria lugar à concavidade lateral. Na anatomia descritiva, porém, a convexidade anterior ocupa os <em>dois terços</em> mediais, e a transição para a concavidade fica mais lateral, perto da junção dos terços médio e lateral. Por isso este atlas usa a <strong>junção dos terços medial e médio medida ao longo do osso</strong> — palpada da articulação esternoclavicular ao acrômio e dividida em três —, e não a curvatura palpada.',
          'Lateralmente, o <strong>sulco deltopeitoral</strong> (entre deltoide e parte clavicular do peitoral maior, por onde sobe a veia cefálica) leva à <strong>fossa infraclavicular</strong> e ao <strong>processo coracoide</strong>, palpável sob a borda anterior do deltoide; ali a veia ainda é axilar. Medialmente, o <strong>ângulo do esterno</strong> marca a 2ª cartilagem costal e fica aproximadamente no plano da carina. Bannon et al. o usam como marco externo para estimar o comprimento do cateter (distância da punção ao ângulo, ao longo do trajeto venoso), mas a junção cavoatrial está alguns centímetros abaixo dele. Acima da clavícula, as cabeças do esternocleidomastóideo delimitam a <strong>fossa supraclavicular menor</strong>, sobre a jugular interna e a confluência venosa.',
          'Obesidade, musculatura desenvolvida, fraturas consolidadas, cirurgias prévias, deformidades torácicas e a posição do ombro alteram a palpação. Em 86 inserções filmadas num centro de trauma, a identificação inadequada dos marcos esteve entre os seis erros técnicos mais frequentes (Kilbourne et al.).'
        ],
        keyPoints: [
          'Incisura jugular: referência mediana de <em>direção</em> no plano frontal — não de profundidade.',
          'Junção dos terços medial e médio da clavícula: referência; a entrada descrita fica 1–2 cm inferior e lateral a ela.',
          'Ângulo do esterno: nível da 2ª cartilagem costal e, aproximadamente, da carina; serve para estimar o comprimento do cateter — a junção cavoatrial fica abaixo dele.',
          'Sulco deltopeitoral e coracoide: região em que a veia ainda é axilar.'
        ],
        pitfalls: [
          'Usar a curvatura palpada (que pode estar perto da junção dos terços médio e lateral) em vez da junção dos terços medial e médio medida ao longo do osso.',
          'Palpar os marcos com o ombro numa posição e puncionar com ele em outra.',
          'Usar a pele deprimida pelo polegar como medida de profundidade.'
        ],
        detail: 'A pele está translúcida para mostrar o esqueleto sob os marcos; o ângulo do esterno aparece no osso como a crista da junção manubrioesternal. O subcutâneo do modelo é o de um homem magro — cerca de 0,3 cm sobre o esterno e a clavícula, chegando a ≈1 cm no abdome —; na prática, varia muito entre pacientes e entre regiões do mesmo tórax. A região de entrada é apresentada no capítulo “Entrada”.',
        sources: [1, 11],
        quiz: {
          q: 'Para que serve, na técnica por marcos, a junção dos terços medial e médio da clavícula?',
          options: [
            'Indicar a profundidade em que a veia será encontrada',
            'Garantir que a ponta da agulha fique anterior à pleura',
            'Servir de referência para a região de entrada e para a passagem sob a clavícula',
            'Marcar o ponto em que a veia axilar se torna subclávia'
          ],
          answer: 2,
          explain: 'É uma referência de superfície: a punção descrita fica 1–2 cm inferior e lateral a ela (Bannon et al.). Não informa profundidade nem protege a pleura; a veia axilar torna-se subclávia na borda lateral da 1ª costela, um marco profundo.'
        },
        scene: {
          view: { target: [5.5, -1.5, 1.5], radius: 45, az: -0.12, el: 0.12 },
          // sem a camada 'aids': os anéis de incisura/entrada pertencem aos capítulos da mão e da entrada
          layers: ['skin', 'bones'],
          ghost: { skin: 0.32 },
          state: S(),
          clip: null,
          labels: [
            ['notchSkin', 'Incisura jugular'],
            ['clavicleSkinR', 'Clavícula — junção dos terços'],
            ['sternalAngleSkin', 'Ângulo do esterno'],
            ['infraclavicularFossaR', 'Fossa infraclavicular'],
            ['deltopectoralR', 'Sulco deltopeitoral'],
            ['coracoidSkinR', 'Processo coracoide'],
            ['lesserSupraclavFossaR', 'Fossa supraclavicular menor']
          ],
          highlight: 'clavicle-R',
          anim: null
        },
        inset: null
      },

      /* ---------------------------------------------------------------- 02 */
      {
        id: 'espaco', n: '02', short: 'Espaço',
        title: 'O espaço costoclavicular em camadas',
        focus: 'Sob a clavícula não há túnel vazio: a veia ocupa a parte anterior de um espaço estreito, encostada em músculo, osso, artéria e pleura.',
        body: [
          'A veia axilar passa a chamar-se <strong>subclávia</strong> na borda lateral da <strong>1ª costela</strong>. Daí até o ângulo venoso, ela cruza a face superior da costela, imediatamente posterior e inferior ao terço medial da clavícula e ao <strong>músculo subclávio</strong>, e anterior ao <strong>escaleno anterior</strong>. É um segmento curto, que termina atrás da articulação esternoclavicular.',
          'O espaço pode ser lido como um triângulo: clavícula com o subclávio à frente e acima, 1ª costela embaixo, escaleno anterior atrás. A veia ocupa a parte anterior; atrás do escaleno — com cerca de 1–1,5 cm de espessura — passam a <strong>artéria subclávia</strong> e, acima e atrás dela, os troncos do <strong>plexo braquial</strong>. Lateralmente à 1ª costela, artéria e nervos ficam diretamente atrás da veia axilar, <em>sem</em> músculo interposto (Bannon et al.).',
          'A adventícia da veia está presa ao periósteo da clavícula, ao <strong>ligamento costoclavicular</strong> e às fáscias do subclávio e do escaleno anterior. Essas fixações mantêm a veia aberta mesmo em hipovolemia — em cadáveres, ela permanece patente quando a jugular interna e a braquiocefálica estão colapsadas —, uma vantagem relativa da via subclávia no choque (Bannon et al.).',
          'Medialmente ao escaleno e à costela, a artéria arqueia mais alto e a veia passa a se apoiar quase diretamente na <strong>pleura cervical</strong>. A 1ª costela interpõe osso apenas em parte do trajeto: não é um escudo contínuo.'
        ],
        keyPoints: [
          'Limites: clavícula/subclávio (anterossuperior), 1ª costela (inferior), escaleno anterior (posterior).',
          'Veia anterior ao escaleno anterior; artéria e plexo posteriores a ele.',
          'Fixações fibrosas mantêm a veia aberta mesmo em hipovolemia.',
          'Medialmente, a veia apoia-se na pleura; lateralmente à costela, a artéria fica logo atrás da veia.'
        ],
        pitfalls: [
          'Imaginar a 1ª costela como “piso de segurança” contínuo sob todo o trajeto.',
          'Insistir medialmente: o ligamento costoclavicular, às vezes calcificado, pode bloquear a passagem (Bannon et al.).'
        ],
        detail: 'A cena olha o espaço de frente e um pouco pela direita, quase na horizontal, com ossos e músculos translúcidos: a clavícula fica acima e à frente da veia, com o subclávio entre ambas; a veia cruza a 1ª costela à frente do escaleno anterior (destacado). Gire a vista para conferir as relações. Espessuras de fáscias e a separação entre estruturas são aproximadas; no corpo, os planos estão justapostos, sem folgas visíveis.',
        sources: [1, 2],
        quiz: {
          q: 'Qual estrutura separa a veia subclávia, anterior, da artéria subclávia e do plexo braquial, posteriores?',
          options: [
            'Músculo escaleno anterior',
            'Músculo subclávio',
            'Ligamento costoclavicular',
            'Músculo escaleno médio'
          ],
          answer: 0,
          explain: 'O escaleno anterior insere-se no tubérculo da 1ª costela entre o sulco da veia (à frente) e o da artéria (atrás). O escaleno médio fica atrás da artéria e do plexo; o subclávio, acima e à frente da veia.'
        },
        scene: {
          // vista anterolateral quase horizontal, com a clavícula translúcida: na vista 'close' o osso opaco
          // escondia justamente a veia sobre a 1ª costela. Com az −0,42 a 2ª parte da artéria fica atrás do
          // escaleno destacado (rótulo “profundo”), e a veia, à frente dele
          view: { target: [5.0, 0.4, -1.3], radius: 19.5, az: -0.42, el: -0.05 },
          layers: ['bones', 'muscle', 'vein', 'artery', 'nerve', 'pleura', 'aids'],
          ghost: { muscle: 0.52, bones: 0.4 },
          state: S(),
          clip: null,
          labels: [
            ['subclaviusR', 'Músculo subclávio'],
            ['scvR', 'Veia subclávia'],
            ['scaleneAntR', 'Escaleno anterior'],
            ['scaR', 'Artéria subclávia (2ª parte)'],
            ['plexusR', 'Plexo braquial (troncos)'],
            ['firstRibR', '1ª costela'],
            ['cupulaR', 'Cúpula pleural']
          ],
          highlight: 'scalene-ant-R',
          anim: null
        },
        inset: null
      },

      /* ---------------------------------------------------------------- 03 */
      {
        id: 'vasos', n: '03', short: 'Vasos D×E',
        title: 'Vasos: trajeto, confluência e assimetria direita × esquerda',
        focus: 'À direita, a subclávia encontra a jugular interna atrás da articulação esternoclavicular e muda de direção de forma acentuada para descer à veia cava superior.',
        body: [
          'A veia subclávia direita une-se à <strong>jugular interna</strong> no <strong>ângulo venoso</strong>, atrás da extremidade esternal da clavícula, e forma a <strong>veia braquiocefálica direita</strong>: curta e quase vertical, ela encontra a esquerda e forma a <strong>veia cava superior</strong> atrás da 1ª cartilagem costal direita. A <strong>braquiocefálica esquerda</strong> é longa e oblíqua e cruza a linha média à frente dos ramos do arco aórtico.',
          'Consequência prática: da subclávia direita ao eixo da cava, o trajeto faz uma curva quase em ângulo reto, enquanto a subclávia esquerda chega por um arco suave. Bannon et al. associam essa geometria a mais mau posicionamento a partir da subclávia direita e à dificuldade de passar introdutores e cateteres rígidos por esse lado. Numa revisão sistemática de estudos não randomizados, o mau posicionamento foi mais frequente pela subclávia do que pela jugular interna (9,3% × 5,3%; Ruesch et al.).',
          'Nas artérias, a assimetria é outra: à direita, a subclávia nasce do <strong>tronco braquiocefálico</strong>, que se bifurca atrás da articulação esternoclavicular direita em subclávia e <strong>carótida comum</strong>; à esquerda, a subclávia sai diretamente do arco. Na base do pescoço, a jugular interna fica <em>lateral</em> à carótida comum, com o vago atrás, entre ambas.',
          'Linfáticos: o <strong>ducto torácico</strong> termina na confluência venosa <em>esquerda</em>. Numa revisão sistemática de 1.352 ductos, desembocava mais frequentemente na própria jugular interna (≈54%), no ângulo jugulossubclávio (≈26%) ou na subclávia (≈8%) (Bellier et al.). À direita, chega apenas o curto ducto linfático direito.'
        ],
        keyPoints: [
          'Axilar → subclávia na borda lateral da 1ª costela; subclávia + jugular interna → braquiocefálica atrás da articulação esternoclavicular.',
          'Braquiocefálica direita curta e vertical; esquerda longa e oblíqua.',
          'Curva acentuada à direita: mais mau posicionamento e mais dificuldade com introdutores rígidos.',
          'Tronco braquiocefálico só à direita; ducto torácico na confluência esquerda.'
        ],
        pitfalls: [
          'Transpor para o lado esquerdo números e curvas que valem para o direito (e vice-versa).',
          'Supor que ausência de resistência garante que o fio seguiu para a cava: a confluência permite desvio para a jugular interna.'
        ],
        detail: 'Calibres e trajetos são nominais. Variações como veia cava superior esquerda persistente, ducto torácico com terminação múltipla ou artéria subclávia direita aberrante não estão representadas.',
        sources: [1, 13, 23],
        quiz: {
          q: 'Por que o trajeto subclávia direita → veia cava superior predispõe a mau posicionamento do fio ou do cateter?',
          options: [
            'Porque a veia subclávia direita é mais longa que a esquerda',
            'Porque o ducto torácico desemboca no ângulo venoso direito',
            'Porque a veia braquiocefálica direita cruza a linha média',
            'Porque, ao receber a jugular interna, o trajeto muda de direção de modo acentuado'
          ],
          answer: 3,
          explain: 'A curva quase em ângulo reto na confluência direita (Bannon et al.) favorece desvios para a jugular interna ou para o lado oposto. O ducto torácico termina à esquerda, e quem cruza a linha média é a braquiocefálica esquerda.'
        },
        scene: {
          // az levemente positivo (vista um pouco pela esquerda): com az −0,08 a veia torácica interna D cruzava
          // à frente da âncora da VCS (rótulo “profundo”); com 0,1 a VCS fica livre (onda 3, w2fix_data_probe)
          view: { target: [1.4, -3.0, -2.6], radius: 39, az: 0.1, el: 0.1 },
          layers: ['bones', 'vein', 'artery', 'lymph', 'aids'],
          ghost: { bones: 0.3 },
          state: S(),
          clip: null,
          labels: [
            ['scvR', 'Veia subclávia D'],
            ['ijvR', 'Jugular interna D'],
            ['venousAngleR', 'Ângulo venoso D'],
            ['bcvR', 'Braquiocefálica D (curta)'],
            ['lbcv', 'Braquiocefálica E (longa)'],
            ['svc', 'Veia cava superior'],
            ['bct', 'Tronco braquiocefálico']
          ],
          highlight: 'scv-R',
          anim: null,
          // linhas do quadro "Assimetria D × E" (o texto cita introdutores rígidos, artéria e linfáticos da confluência)
          insetRows: ['Veia braquiocefálica', 'Trajeto', 'Mau posicionamento', 'Introdutores', 'Artéria subclávia', 'Linfáticos']
        },
        inset: 'asymmetry'
      },

      /* ---------------------------------------------------------------- 04 */
      {
        id: 'atras', n: '04', short: 'Atrás da veia',
        title: 'O que fica atrás e acima da veia',
        focus: 'Um trajeto que se aprofunda além da veia encontra, conforme o nível, escaleno e frênico, artéria e plexo — ou diretamente a pleura.',
        body: [
          'A partir da junção axilossubclávia, as relações posteriores da veia são, em sequência, o escaleno anterior com o <strong>nervo frênico</strong> sobre sua face anterior, a artéria subclávia e, mais acima e atrás, o plexo braquial. Medialmente ao músculo, o frênico desliza para a frente da artéria, passa entre ela e a veia e entra no tórax; ali, as relações posteriores da veia passam a ser o frênico, a <strong>artéria torácica interna</strong> e a pleura apical (Bannon et al.).',
          'O <strong>vago</strong> direito desce entre a jugular interna e a carótida comum, cruza à frente da 1ª parte da artéria subclávia e emite o <strong>nervo laríngeo recorrente</strong> direito, que contorna a artéria por baixo e por trás e sobe no sulco traqueoesofágico. Atrás da artéria, junto ao colo da 1ª costela, fica o <strong>gânglio cervicotorácico (estrelado)</strong>.',
          'A torácica interna nasce da face inferior da 1ª parte da subclávia e desce atrás das cartilagens costais, lateral à borda do esterno — em 100 tomografias, em média a 1,57 ± 0,30 cm dela à direita, com a veia homônima mais medial, a cerca de 1 cm (Glassberg et al.).',
          'A <strong>cúpula pleural</strong>, com o ápice pulmonar, sobe acima da parte anterior da 1ª costela, atrás dos vasos subclávios. Inclinar a agulha para baixo (caudal) ou para trás encurta o caminho até ela; avançar no plano coronal favorece encontrar a veia antes da pleura (Bannon et al.).'
        ],
        keyPoints: [
          'Sobre a costela: escaleno anterior com o frênico → artéria → plexo.',
          'Medial ao escaleno: frênico, torácica interna e pleura apical logo atrás da veia.',
          'O vago cruza à frente da 1ª parte da artéria; o recorrente direito contorna a subclávia.',
          'Inclinação caudal ou posterior aproxima a agulha da pleura.'
        ],
        pitfalls: [
          'Corrigir a falta de refluxo aprofundando a agulha: além da veia só há estruturas em risco.',
          'Esquecer que um hematoma arterial pode comprimir o plexo mesmo sem lesão direta do nervo (Bannon et al.).'
        ],
        detail: 'Vista de cima e da frente, com veias, músculos e ossos translúcidos. Nervos estão engrossados para leitura; o trajeto do recorrente e a posição do gânglio estrelado são esquemáticos. Em projeção anterior, o ápice da cúpula do modelo fica ≈2,4 cm acima do <em>eixo</em> do terço medial da clavícula e ≈1,5 cm acima da sua <em>borda superior</em>. A referência anatômica clássica (“2–3 cm acima do terço medial da clavícula”) é aproximada e não diz de qual nível se mede: o modelo a atinge medindo pelo eixo, não pela borda superior. São valores nominais, não medidas de paciente.',
        sources: [1, 2, 24],
        quiz: {
          q: 'Na porção medial ao escaleno anterior, qual relação posterior da veia torna perigoso um trajeto profundo?',
          options: [
            'O plexo braquial',
            'A pleura apical (cúpula pleural)',
            'O músculo escaleno médio',
            'O processo coracoide'
          ],
          answer: 1,
          explain: 'Medialmente, a artéria arqueia mais alto e a veia passa a se apoiar na pleura apical; agulha profunda nesse nível atinge pleura e pulmão (Bannon et al.). O plexo e o escaleno médio são relações mais laterais e posteriores.'
        },
        scene: {
          // vista superior-anterior: enquadra da cúpula à torácica interna (itaR), que ficava fora do quadro
          view: { target: [3.6, 0.6, -3.4], radius: 26, az: -0.35, el: 0.95 },
          layers: ['bones', 'muscle', 'vein', 'artery', 'nerve', 'pleura', 'lung', 'aids'],
          ghost: { vein: 0.45, muscle: 0.22, bones: 0.35 },
          state: S(),
          clip: null,
          labels: [
            ['phrenicR', 'Nervo frênico'],
            ['vagusR', 'Nervo vago'],
            ['recurrentR', 'Laríngeo recorrente D (sob a subclávia)'],
            ['plexusR', 'Plexo braquial'],
            ['stellateR', 'Gânglio estrelado'],
            ['itaR', 'Artéria torácica interna'],
            ['cupulaR', 'Cúpula pleural (sob artéria e plexo)']
          ],
          highlight: 'phrenic-R',
          anim: null
        },
        inset: null
      },

      /* ---------------------------------------------------------------- 05 */
      {
        id: 'mao', n: '05', short: 'Mão esquerda',
        title: 'Mão esquerda: dois marcos, funções distintas',
        focus: 'Indicador = referência de direção na incisura. Polegar = pressão suave infraclavicular que ajuda a manter o conjunto rente sob a clavícula. Nenhum dos dois mede profundidade.',
        body: [
          'O operador fica do lado a ser puncionado (Bannon et al.). Para o destro à direita do paciente, a mão esquerda apoia-se com o punho oblíquo e confortável: a polpa do <strong>indicador</strong> identifica a incisura jugular; o <strong>polegar</strong> — que nasce do bordo radial da palma, junto ao indicador — alcança a região infraclavicular. A abertura entre os dedos varia com o tórax e com o tamanho da mão.',
          'O indicador dá a referência medial da <strong>direção</strong>: a agulha é orientada para um ponto logo acima da sua polpa. Apontar para a incisura não informa onde está a ponta. O indicador repousa sobre a incisura: não penetra nela nem “busca” a ponta através do tórax.',
          'Em Bannon et al., o polegar não dominante exerce apenas <strong>pressão suave</strong> para manter a agulha deprimida no plano coronal, rente sob a clavícula — e isso basta quando o ponto de entrada é adequado. O documento-base descreve o polegar apoiado nos tecidos infraclaviculares. Nos dois casos a pressão é suave: o polegar não é paquímetro de profundidade, batente, alavanca nem escudo da pleura.',
          'Médio, anular e mínimo ficam fletidos nas articulações metacarpofalângicas e interfalângicas, longe do instrumento. Depois do refluxo, a mão esquerda muda de função e estabiliza o canhão com apoio no paciente: deslocar a agulha para fora da veia antes ou durante a passagem do fio está entre os erros técnicos mais observados (Kilbourne et al.).'
        ],
        keyPoints: [
          'Indicador na incisura jugular: alvo de direção — a agulha é orientada logo acima da polpa.',
          'Polegar infraclavicular: pressão suave que mantém agulha e seringa no plano coronal, rente sob a clavícula — não alavanca.',
          'Médio, anular e mínimo fletidos, fora da trajetória.',
          'Após o refluxo, a mão de apoio passa a estabilizar a agulha.'
        ],
        pitfalls: [
          'Usar o polegar como alavanca para dobrar a agulha ou levar a ponta, já profunda, para trás da clavícula.',
          'Manter rigidamente a pose inicial quando ela atrapalha a estabilização da agulha.',
          'Deixar a agulha sair da veia ao desconectar a seringa para passar o fio.'
        ],
        detail: 'Use o botão ▶ ao lado de “Mão” ou o controle Preparar–Apoiar: a mão se aproxima enquanto os dedos se organizam, até o contato final. A seta do polegar indica a direção da pressão suave, sem quantificar força. A partir da passagem do fio-guia, a mão sai de cena no modelo para expor canhão, fio e cateter — na prática, ela continua estabilizando o canhão. A mão é uma malha articulada contínua (WebXR generic-hand, licença MIT) com material de luva; o polegar tem duas falanges e os demais dedos, três.',
        sources: [1, 11],
        quiz: {
          q: 'Qual é a função da polpa do polegar esquerdo na abordagem infraclavicular por marcos?',
          options: [
            'Medir a profundidade da veia pela depressão da pele',
            'Funcionar como batente que limita o avanço da agulha',
            'Fazer alavanca para levar a ponta, já profunda, para trás da clavícula',
            'Exercer pressão suave que ajuda a manter o conjunto no plano coronal, rente sob a clavícula'
          ],
          answer: 3,
          explain: 'Bannon et al. descrevem apenas pressão suave do polegar para manter a agulha no plano coronal sob a clavícula, quando a entrada é adequada. O polegar não mede profundidade, não limita o avanço e não é alavanca para a ponta.'
        },
        scene: {
          view: 'hand',
          layers: ['skin', 'hand', 'drape', 'aids'],
          ghost: null,
          state: S({ handPose: 1 }),
          clip: null,
          labels: [
            ['indexTip', 'Indicador — incisura jugular'],
            ['thumbTip', 'Polegar — apoio infraclavicular'],
            ['palm', 'Palma (punho oblíquo)'],
            ['thumbVector', 'Pressão suave do polegar'],
            ['clavicleSkinR', 'Clavícula']
          ],
          highlight: 'operator-hand',
          anim: 'hand'
        },
        inset: null
      },

      /* ---------------------------------------------------------------- 06 */
      {
        id: 'entrada', n: '06', short: 'Entrada',
        title: 'Ponto de entrada: referência não é coordenada',
        focus: 'A região de entrada é definida no paciente, a partir dos marcos e, quando possível, de imagem — não por gabarito trazido de outro tórax.',
        body: [
          'As descrições convergem sem serem idênticas. Bannon et al. situam a punção cutânea 1–2 cm inferior e lateral à junção dos terços medial e médio da clavícula; o documento-base usa cerca de 2 cm lateral e 2 cm caudal à mesma referência, descrição que atribui também a Braner et al. Uma entrada colada à clavícula dificulta passar sob ela sem angular a agulha para trás — e essa angulação posterior aumenta o risco de pneumotórax (Bannon et al.).',
          'Essas distâncias são medidas <strong>na superfície</strong>, a partir de um marco específico. Não equivalem a profundidade e não são transportáveis: tecido adiposo, musculatura, posição do ombro, deformidades e acessos prévios mudam as relações. O local de punção inadequado em relação à clavícula foi um dos erros mais comuns em 86 inserções filmadas (Kilbourne et al.).',
          'Nas descrições revisadas, a punção real é precedida de indicação e escolha do sítio, assepsia com clorexidina e barreira estéril máxima (Bannon et al.), anestesia local, monitorização, ultrassom disponível e plano de resgate com equipe habilitada. O círculo na cena marca uma <em>região ilustrativa</em>, não um alvo clínico validado.'
        ],
        keyPoints: [
          'Entrada descrita: 1–2 cm inferior e lateral à junção dos terços medial e médio (Bannon et al.).',
          'Distância de superfície ≠ profundidade.',
          'Entrada colada à clavícula obriga a angular para trás — mais risco pleural.',
          'Preparo: clorexidina, barreira estéril máxima, plano de resgate.'
        ],
        pitfalls: [
          'Compensar uma entrada mal escolhida aprofundando a ponta às cegas.',
          'Copiar medidas de superfície entre pacientes de biotipos diferentes.'
        ],
        detail: 'No modelo, o anel da região de entrada fica cerca de 1 cm abaixo da borda inferior da clavícula, porém mais lateral do que os 1–2 cm descritos por Bannon et al.: ≈2,5 cm lateral e ≈1,5 cm caudal à junção dos terços (medidas na superfície do modelo). É uma posição ilustrativa, não um ponto validado: no paciente, a entrada se define pelos marcos dele. A cena se afasta para mostrar a mão de apoio, a agulha, o canhão e a seringa juntos.',
        sources: [1, 5, 11],
        quiz: {
          q: 'Por que um ponto de entrada muito próximo da clavícula é desfavorável?',
          options: [
            'Porque obriga a angular a agulha para trás para passar sob o osso, encurtando o caminho até a pleura',
            'Porque a veia é mais superficial nesse ponto',
            'Porque a artéria fica à frente da veia nessa região',
            'Porque impede a palpação da incisura jugular'
          ],
          answer: 0,
          explain: 'Bannon et al.: entrada próxima demais da clavícula dificulta a passagem sob ela; dirigir a agulha posteriormente para contornar o osso aumenta muito o risco de pneumotórax.'
        },
        scene: {
          // vista ampla: mão, agulha, canhão e seringa no mesmo quadro (a vista 'hand' cortava a seringa)
          view: { target: [10.5, 0.2, 3], radius: 42, az: -0.2, el: 0.35 },
          layers: ['skin', 'hand', 'instrument', 'drape', 'aids'],
          ghost: null,
          state: S({ phase: 1, handPose: 1 }),
          clip: null,
          labels: [
            ['entry', 'Região ilustrativa de entrada'],
            ['clavicleSkinR', 'Junção dos terços (referência)'],
            ['notchSkin', 'Incisura jugular'],
            ['indexTip', 'Indicador'],
            ['thumbTip', 'Polegar'],
            ['thumbVector', 'Pressão suave do polegar (direção)'],
            ['needleTip', 'Ponta (ainda fora da pele)']
          ],
          highlight: null,
          anim: null
        },
        inset: null
      },

      /* ---------------------------------------------------------------- 07 */
      {
        id: 'planos', n: '07', short: 'Planos',
        title: 'Direção × inclinação: dois planos, dois números',
        focus: 'Vista de frente, o eixo segue medialmente rumo à incisura; vista pela cabeceira, agulha e seringa ficam o mais paralelas possível ao plano coronal. Um ângulo publicado só vale no plano em que foi definido.',
        body: [
          'No <strong>plano frontal</strong> (vista anterior), a direção é medial e discretamente cranial, mirando logo acima da polpa do indicador na incisura jugular. Apontar cranialmente, afastando-se da incisura, é erro técnico recorrente (Kilbourne et al.); girar o trajeto para trás, também se afastando da incisura, encurta o caminho até a artéria atrás do escaleno (Bannon et al.).',
          'A <strong>inclinação</strong> em relação à parede torácica se lê num plano perpendicular ao coronal que contenha a agulha. Como o trajeto é sobretudo mediolateral, esse plano é quase <strong>axial</strong>: é a vista pela cabeceira desta cena — e não o perfil, que encurta o eixo da agulha e exagera a inclinação. Bannon et al. descrevem o avanço com agulha e seringa “absolutamente paralelas ao chão”, no plano coronal: levantar o conjunto da parede angula a ponta para trás e, como a veia se apoia na pleura, coloca a pleura no caminho; angular a ponta caudalmente também encurta o trajeto até ela.',
          'Algumas descrições usam inclinação maior apenas para atravessar a pele e achatam o conjunto logo depois (o documento-base cita 20–30°); esse número descreve técnica, não é ângulo protetor. <strong>No modelo</strong>, a reta pele → veia é rígida e fica mais inclinada do que “paralela ao chão”, porque a geometria não simula a depressão dos tecidos pelo polegar nem o achatamento do conjunto depois da pele. O setor dourado de “Planos/ângulos” mede essa inclinação nominal do modelo (≈30°) — não é alvo nem margem.',
          'Também é erro frequente a trajetória rasa demais, que encontra o periósteo da clavícula (Kilbourne et al.). Os 3–4 cm citados no documento-base referem-se a comprimento de agulha avançado em descrições específicas — não à profundidade perpendicular pele–veia nem ao momento de mudar o ângulo. Nas descrições de ensino, a ausência de refluxo interrompe o avanço para reavaliação; o número não autoriza continuar avançando.'
        ],
        keyPoints: [
          'Plano frontal (vista anterior): direção medial, logo acima da incisura jugular.',
          'Inclinação: lida pela cabeceira, em plano quase axial; conjunto o mais paralelo possível ao plano coronal sob a clavícula, sem levantar a seringa (Bannon et al.).',
          'Cranial demais e raso demais são erros frequentes; posterior ou caudal demais aproxima artéria e pleura.',
          'Ângulos e comprimentos citados não são intercambiáveis entre planos.'
        ],
        pitfalls: [
          'Ler a inclinação no perfil (o eixo aparece encurtado e o ângulo, exagerado) ou usar o ângulo de um plano para corrigir o outro.',
          'Levantar a seringa para “descer” a ponta sob a clavícula.',
          'Tratar 3–4 cm de agulha como profundidade ou como gatilho para mudar o ângulo.'
        ],
        detail: 'Vista pela cabeceira, quase axial: o lado direito do paciente fica à esquerda da tela e a parede anterior do tórax, embaixo. A câmera está no plano sagital, de modo que o ângulo da haste na tela é praticamente o ângulo com o plano coronal (≈30° no modelo); girar a vista para os lados distorce essa leitura. O controle “Planos/ângulos” mostra o plano coronal que passa pela entrada e, em dourado, o ângulo nominal da reta do modelo — maior que o descrito por Bannon et al., porque a agulha é rígida e o modelo não simula a depressão dos tecidos pelo polegar. Também não há simulador de “X cm e depois virar”: a geometria da animação não determina profundidade real.',
        sources: [1, 11],
        quiz: {
          q: 'O conjunto agulha-seringa é levantado da parede torácica para “passar” sob a clavícula. Qual o principal risco anatômico?',
          options: [
            'Punção da veia cefálica',
            'Perda da referência da incisura jugular',
            'Trajeto mais curto até a pleura apical',
            'Lesão do nervo vago'
          ],
          answer: 2,
          explain: 'Levantar a seringa angula a ponta para trás, mais profunda; como medialmente a veia se apoia na pleura, o trajeto até ela fica mais curto (Bannon et al.). Angular a ponta caudalmente é outro mecanismo que também encurta esse trajeto.'
        },
        scene: {
          // vista pela cabeceira com az 0 e el 1,45 (máximo do arrasto): a câmera fica no plano sagital, e o
          // ângulo da haste na tela coincide com o ângulo real com o plano coronal (30,0° no modelo, onda 3; medir com
          // tools/w2fix_data_probe.js se LM.needle mudar).
          // Com az −0,25 / el 1,25 a tela mostrava 46°, exagerando a inclinação que o capítulo critica.
          // Planos desligados por padrão — o ângulo nominal do modelo é maior que o descrito (ver detail).
          view: { target: [9.4, 0.3, 2.6], radius: 31, az: 0, el: 1.45 },
          layers: ['skin', 'bones', 'vein', 'instrument', 'aids'],
          ghost: { skin: 0.15 },
          state: S({ phase: 2, handPose: 1, showPlanes: false }),
          clip: null,
          labels: [
            ['entry', 'Entrada na pele'],
            ['needleTip', 'Ponta logo sob a pele'],
            ['clavicleR', 'Clavícula'],
            ['scvR', 'Veia subclávia (sob a clavícula)'],
            ['notchSkin', 'Incisura jugular (direção)']
          ],
          highlight: 'needle',
          anim: null
        },
        inset: 'planes'
      },

      /* ---------------------------------------------------------------- 08 */
      {
        id: 'tecidos', n: '08', short: 'Tecidos',
        title: 'Sob a clavícula: tecidos atravessados e contato ósseo',
        focus: 'Contato ósseo é um achado que, nas descrições de ensino, interrompe o avanço para reavaliação — não passo obrigatório nem apoio para “descer” a ponta.',
        body: [
          'No trajeto infraclavicular a agulha atravessa, do superficial ao profundo: pele, tela subcutânea, fáscia e parte clavicular do <strong>peitoral maior</strong>, <strong>fáscia clavipeitoral</strong> e <strong>músculo subclávio</strong>, até a parede anterior da veia sobre a 1ª costela (Bannon et al. descrevem a passagem através do subclávio). A espessura total depende do biotipo e da compressão exercida pelo polegar.',
          'O documento-base apresentava “tocar a clavícula, recuar e abaixar” como sequência obrigatória. Neste atlas, o contato ósseo é um achado: atravessar o periósteo da clavícula está, inclusive, entre os erros técnicos mais observados (Kilbourne et al.). Não se ensina raspar o osso, “caminhar” sob ele com a ponta profunda nem forçar a passagem.',
          'Correções de direção com a ponta profunda movem-na como braço de alavanca e podem lesar estruturas vizinhas. Nas descrições de ensino, a agulha <strong>recua até o plano superficial antes de ser redirecionada</strong>, conforme treinamento e protocolo. O atlas não fixa 3–5 mm, nem qualquer outro valor, como recuo suficiente.',
          'O corte parassagital da cena passa pelo espaço costoclavicular, um pouco medial ao ponto em que a agulha alcança a veia, e é visto pela direita: a clavícula acima e à frente; logo abaixo dela, o <strong>subclávio</strong> (destacado), à frente da veia — o músculo que a agulha atravessa antes da parede venosa; a 1ª costela sob a veia; o escaleno anterior atrás dela e, atrás do músculo, a artéria, o plexo e a cúpula pleural — tudo o que existe além do alvo. É o triângulo costoclavicular-escalênico (clavícula à frente, 1ª costela embaixo, escaleno anterior atrás), descrito por Aiken e Minton e citado por Bannon et al.'
        ],
        keyPoints: [
          'Sequência: pele → subcutâneo → peitoral maior → fáscia clavipeitoral → subclávio → veia.',
          'Contato ósseo: interrupção, recuo ao plano superficial e reavaliação.',
          'Redirecionar com a ponta profunda é perigoso.',
          'Atravessar o periósteo e trajetória rasa demais estão entre os erros mais frequentes.'
        ],
        pitfalls: [
          'Usar a clavícula como trilho para “descer” a ponta.',
          'Aprofundar depois do contato ósseo em vez de recuar.'
        ],
        detail: 'Corte parassagital pelo espaço costoclavicular, visto pela direita e um pouco pela frente: a parte lateral ao plano foi removida. A agulha corre sobretudo de lateral para medial e não cabe num plano parassagital; por isso aparece inteira, à frente do corte, com a ponta na luz venosa logo depois da parede, passando rente ao subclávio seccionado. Os rótulos da clavícula e do subclávio apontam para as secções nesta vista; ao girar a cena, afastam-se delas, porque marcam a parte lateral do osso e do músculo, removida pelo corte. É uma linha reta idealizada, sem deflexão do bisel, deformação de tecido nem resistência simulada. Medida no modelo, a reta cruza pele e subcutâneo, peitoral maior, fáscia clavipeitoral e ≈1 cm de subclávio, rente à face posteroinferior da clavícula, e alcança a parede da veia ≈3,9 cm após a pele, junto à borda lateral da 1ª costela (transição axilar → subclávia) — distâncias nominais de um tórax magro, não profundidades de referência.',
        sources: [1, 11],
        quiz: {
          q: 'Durante o avanço, a ponta encontra osso. Qual conduta é coerente com este atlas?',
          options: [
            'Raspar a face inferior da clavícula até “cair” sob ela',
            'Interromper, recuar até o plano superficial e reavaliar marcos e direção',
            'Aumentar a inclinação posterior mantendo a ponta profunda',
            'Avançar mais 1 cm, porque o osso protege a pleura'
          ],
          answer: 1,
          explain: 'Contato ósseo é achado que leva à reavaliação. Redirecionar com a ponta profunda e passar pelo periósteo são erros descritos (Kilbourne et al.); angular para trás aproxima a pleura (Bannon et al.).'
        },
        scene: {
          // Onda 4: corte em x = 5,5 (era 5,0). Medido em Node (tools/w2fix_data_w4sec.js): em x = 5,5 a secção
          // ainda contém clavícula, subclávio (0,4 × 0,6 cm, colado à face inferior da clavícula e à frente da
          // veia), veia sobre a 1ª costela, escaleno anterior atrás dela (perto da inserção), artéria, plexo e
          // pleura; em x = 5,0 o subclávio é a ponta tendínea baixa, no nível da metade inferior da veia, e fica
          // sob a projeção da agulha; em x ≥ 5,6 o escaleno sai da secção e, em x ≈ 6,2, a costela passa a ficar
          // atrás da veia (não sob ela). Câmera alinhada: alvo = centro da secção do subclávio Q [5,5; 0,38; 0,575]
          // e câmera na reta Q → âncora subclaviusR [8,95; 0,34; 1,13] (az/el calculados), de modo que o rótulo
          // do subclávio cai sobre a secção do músculo (o zoom mantém o alinhamento; girar, não). clavicleMidR
          // fica ≈ sobre a secção da clavícula pelo mesmo motivo. Raio 26 reduz a seringa no quadro.
          view: { target: [5.5, 0.38, 0.575], radius: 26, az: -1.4113, el: -0.0114 },
          layers: ['skin', 'bones', 'muscle', 'vein', 'artery', 'nerve', 'pleura', 'lung', 'instrument'],
          ghost: null,
          state: S({ phase: 4, handPose: 1 }),
          clip: { normal: [-1, 0, 0], point: [5.5, 0, 0], label: 'Corte parassagital do espaço costoclavicular' },
          // 7 rótulos (limite do CONTENT_SPEC): a ponta entra no rótulo da veia; o plexo (amarelo, acima e atrás
          // da artéria) fica citado no texto
          labels: [
            ['subclaviusR', 'Músculo subclávio (em corte)'],
            ['clavicleMidR', 'Clavícula (em corte)'],
            ['scvR', 'Veia subclávia, com a ponta na luz'],
            ['firstRibR', '1ª costela'],
            ['scaleneAntR', 'Escaleno anterior'],
            ['scaR', 'Artéria subclávia'],
            ['cupulaR', 'Cúpula pleural']
          ],
          highlight: 'subclavius-R',
          anim: null
        },
        inset: 'layers'
      },

      /* ---------------------------------------------------------------- 09 */
      {
        id: 'fio', n: '09', short: 'Refluxo e fio',
        title: 'Refluxo e fio-guia: confirmação antes da dilatação',
        focus: 'Refluxo isolado — sangue escuro, sem pulsação — não basta para afirmar posição venosa antes da dilatação.',
        body: [
          'Na descrição de ensino, o avanço cessa ao refluxo e o conjunto é estabilizado. No modelo, a mão de apoio sai de cena para expor canhão e fio; na prática, ela estabiliza o canhão apoiada no paciente enquanto a seringa é desconectada e o fio introduzido. Perder a veia nessa troca é erro frequente (Kilbourne et al.).',
          'Cor e pulsatilidade não distinguem com segurança veia de artéria; nas descrições revisadas, a posição venosa é confirmada por método objetivo antes da dilatação — manometria, transdução de pressão ou ultrassom mostrando o fio na veia, entre outros, conforme o protocolo do serviço. Num programa com manometria obrigatória, não houve lesão arterial por cateter calibroso em 9.348 cateteres ao longo de 15 anos; no último ano, 4 de 28 punções arteriais só foram reconhecidas pela manometria (Ezaru et al.).',
          'O fio progride <strong>sem força</strong>, com controle contínuo da extremidade externa; resistência interrompe a passagem. Arritmias surgem quando o fio alcança o coração e acompanham o comprimento introduzido: num ECR pela jugular interna direita (69 pacientes), houve arritmia durante a dilatação em 65% com 20 cm de fio × 26% com 15 cm (Lee et al.). Pela subclávia direita as distâncias até a cava são maiores (Bannon et al.), mas a relação é a mesma: fio além do necessário, mais arritmia.',
          'À direita, o fio pode subir pela <strong>jugular interna</strong> na confluência — ative “Fio na VJI” (trajeto anômalo do fio-guia). Girar a cabeça para o lado oposto aumenta o ângulo entre subclávia e jugular e pode favorecer esse desvio (Bannon et al.). A orientação da ponta em J também pesa: num ECR com 295 pacientes, com o J voltado caudalmente o cateter chegou à cava/átrio em 97% (× 57% com o J voltado cranialmente) e foi para a jugular interna em 2% (× 40%) (Tripathi et al.). Por isso, no modelo, a agulha gira antes do fio para que o bisel — e, com ele, a saída do J — fique voltado para os pés; o ensaio avaliou a orientação do J, não a do bisel. A ausência de fio na jugular, isoladamente, não prova posição central correta.'
        ],
        keyPoints: [
          'Agulha estabilizada ao refluxo, sem perder a veia na troca seringa → fio.',
          'Posição venosa confirmada por método objetivo antes de dilatar.',
          'Fio sem força; resistência ou arritmia → interrupção e reavaliação.',
          'À direita, o fio pode desviar para a jugular interna.',
          'Bisel e ponta em J voltados caudalmente (no modelo, o bisel gira para os pés na passagem do fio): num ECR pela subclávia direita, desvio para a jugular interna em 2% com o J caudal × 40% com o J cranial (Tripathi et al.).'
        ],
        pitfalls: [
          'Confiar só na cor do sangue ou na ausência de pulsação.',
          'Introduzir fio longo por rotina.',
          'Girar a cabeça para o lado oposto sem considerar o desvio para a jugular.'
        ],
        detail: 'A cena mostra a relação ponta–luz venosa, o trajeto esperado do fio até a veia cava superior e um trajeto alternativo (anômalo) didático para a jugular interna. A seringa foi retirada, o bisel está girado para os pés e a mão de apoio saiu de cena para deixar canhão e fio à vista. O J (raio de ≈3 mm) é ilustrativo: não se modelam sua retificação dentro da agulha, o efeito real da orientação da curva nem o comportamento do fio na confluência — nem refluxo, compressibilidade ou transfixação da parede.',
        sources: [1, 11, 20, 22, 26],
        quiz: {
          q: 'Após refluxo escuro e não pulsátil, qual o passo seguinte coerente antes da dilatação?',
          options: [
            'Dilatar imediatamente: a cor confirma a veia',
            'Avançar o fio até sentir resistência',
            'Retirar a agulha e marcar a pele',
            'Confirmar a posição venosa por método objetivo, como manometria ou ultrassom do fio na veia'
          ],
          answer: 3,
          explain: 'Cor e pulsação enganam; a confirmação objetiva antes da dilatação evitou lesões arteriais por cateter calibroso numa série de 15 anos (Ezaru et al.). Avançar o fio até haver resistência contraria a descrição de passagem sem força.'
        },
        scene: {
          // enquadra da jugular interna à veia cava superior (a VCS ficava fora do quadro)
          view: { target: [3.2, -1.2, -1.8], radius: 30, az: -0.3, el: 0.12 },
          layers: ['bones', 'vein', 'artery', 'instrument', 'aids'],
          // artérias translúcidas: o capítulo é venoso, e a torácica interna D cruzava à frente da VCS
          ghost: { bones: 0.22, artery: 0.35 },
          state: S({ phase: 5, wireMal: true }),
          clip: null,
          labels: [
            ['wireIJV', 'Trajeto anômalo: jugular interna'],
            ['ijvR', 'Jugular interna D'],
            ['venousAngleR', 'Confluência (ângulo venoso)'],
            ['scvR', 'Veia subclávia'],
            ['bcvR', 'Braquiocefálica D'],
            ['svc', 'Veia cava superior'],
            ['needleTip', 'Ponta da agulha na luz venosa']
          ],
          highlight: 'guidewire',
          anim: 'wire'
        },
        inset: null
      },

      /* ---------------------------------------------------------------- 10 */
      {
        id: 'cateter', n: '10', short: 'Cateter',
        title: 'Dilatador e cateter: até onde vai e onde termina a ponta',
        focus: 'O dilatador abre o trajeto até a parede venosa — segundo Bannon et al., não precisa entrar fundo na veia. A posição da ponta do cateter é confirmada por imagem.',
        body: [
          'Dilatadores são rígidos e calibrosos. Bannon et al. recomendam avançá-los só até a superfície da veia — no máximo a profundidade em que a agulha a acessou, nunca mais que milímetros dentro dela —, porque à direita a curva subclávia → cava favorece a perfuração da parede por um dilatador que não acompanha a curva. As instruções do dispositivo e o protocolo do serviço completam essa descrição.',
          'A posição descrita como ideal para a ponta é a <strong>veia cava superior distal, próxima à junção cavoatrial</strong>, fora do átrio e paralela à parede (Bannon et al.). Na superfície, Bannon et al. medem a distância da punção ao ângulo do esterno, ao longo do trajeto venoso, para estimar quanto introduzir; como o ângulo fica aproximadamente no plano da carina e a junção cavoatrial alguns centímetros abaixo (cerca de 4 cm no modelo, valor nominal), a estimativa é grosseira. Na radiografia, servem de referência o ângulo traqueobrônquico direito — segundo dados citados por Bannon et al., ao menos 2,9 cm acima da junção cavoatrial — e a <strong>carina</strong> (critério conservador: ponta acima dela costuma estar fora do átrio). Numa auditoria em UTI (Stonelake & Bodenham), 74 de 163 cateteres à direita tinham a ponta abaixo da carina, quase nenhum em ângulo agudo com a parede; à esquerda, pontas acima da carina muitas vezes ficavam altas ou em ângulo agudo, e os autores sugerem que ali a ponta abaixo da carina tende a ser mais satisfatória.',
          'Comprimento: em medidas fluoroscópicas citadas por Bannon et al., a distância média da pele à junção cava–átrio foi de 18,4 cm pela subclávia direita (16,0 cm pela jugular interna direita; 21,2 cm pela subclávia esquerda). São médias de referência; a posição final só se confirma por imagem.',
          'Antes do uso, os protocolos incluem aspirar e lavar todas as vias, fixar o cateter, confirmar a posição e pesquisar complicações. Na suspeita de dilatador ou cateter em artéria, Guilbert et al. descrevem <strong>não removê-lo às cegas</strong>: na revisão da literatura dos autores, a retirada seguida de compressão teve complicações maiores em 47% (8/17), contra 0/13 com reparo cirúrgico imediato; na série própria, os 5 casos tratados com compressão tiveram complicações graves, contra 0/8 com reparo aberto ou endovascular.'
        ],
        keyPoints: [
          'Dilatador só até a profundidade da veia (Bannon et al.).',
          'Ponta na cava distal/junção cavoatrial, paralela à parede, fora do átrio.',
          'Carina e ângulo traqueobrônquico direito: referências radiográficas; o ângulo do esterno, no plano da carina, só estima o comprimento.',
          'Cateter calibroso em artéria: a retirada às cegas teve mais complicações que o reparo especializado (Guilbert et al.).'
        ],
        pitfalls: [
          'Introduzir o dilatador em todo o comprimento “por garantia”.',
          'Dar a posição por correta só porque o cateter infunde bem.'
        ],
        detail: 'A cena mostra o <strong>dilatador</strong> sobre o fio, com a ponta parada cerca de 2 mm além da parede anterior da veia (anel dourado = profundidade em que a agulha alcançou a veia, ≈4 cm após a pele no modelo). Em “Etapas da agulha”, escolha “Cateter” para ver o cateter posicionado: três vias (distal, medial e proximal), marcas de comprimento contadas a partir da ponta e canhão com asas. No modelo, ≈16 cm ficam introduzidos — menos que a média de 18,4 cm citada por Bannon et al., num tórax nominal magro — e a ponta para a menos de 1 cm acima da junção cavoatrial (≈0,7–0,9 cm no modelo). O trecho intravascular tem calibre único e segue um trajeto idealizado, sem a deformação real ao contornar a confluência.',
        sources: [1, 19, 21],
        quiz: {
          q: 'Qual o limite de avanço do dilatador recomendado por Bannon et al.?',
          options: [
            'A profundidade em que a veia foi acessada pela agulha',
            'O comprimento total do dilatador',
            'A altura do ângulo do esterno',
            'O comprimento de fio-guia já introduzido'
          ],
          answer: 0,
          explain: 'Para Bannon et al., o dilatador cria o trajeto até a parede da veia, sem avançar dentro dela; à direita, a curva para a cava torna a parede venosa vulnerável a um dilatador rígido.'
        },
        scene: {
          // alvo mais à direita e acima (onda 3): o dilatador inteiro, com o canhão azul, entra no quadro junto da
          // junção cavoatrial, da carina e do ângulo do esterno
          view: { target: [4.0, -4.4, -1.8], radius: 38, az: -0.12, el: 0.08 },
          layers: ['bones', 'vein', 'mediastinum', 'instrument', 'aids'],
          // mediastino opaco: com o fantasma por Fresnel do motor, o coração “fantasma” sumia e a junção
          // cavoatrial ficava sem o átrio de referência
          ghost: { bones: 0.22 },
          // dilatador sobre o fio = fase 5 + dilator (mesma convenção da etapa “Dilatador” de app.js; instruments
          // também aceita a subfase 5,25–5,75). As demais cenas zeram dilator via S()
          state: S({ phase: 5, dilator: true }),
          clip: null,
          labels: [
            ['dilatorTip', 'Ponta do dilatador: só até a parede venosa'],
            ['dilatorLimit', 'Limite: parede da veia'],
            ['cavoatrial', 'Junção cavoatrial (alvo da ponta do cateter)'],
            ['svc', 'Veia cava superior'],
            ['carina', 'Carina (referência radiográfica)'],
            ['sternalAngle', 'Plano do ângulo do esterno (≈ carina)']
          ],
          highlight: 'dilator',
          anim: null
        },
        inset: null
      },

      /* ---------------------------------------------------------------- 11 */
      {
        id: 'respiracao', n: '11', short: 'Respiração',
        title: 'Pulmão e respiração: o ápice não sai do caminho',
        focus: 'Na inspiração, quem mais se move são as bases e as regiões laterais; a cúpula pleural continua junto à veia nas duas fases.',
        body: [
          'Na inspiração, o diafragma desce e o tórax se expande; a mudança é mais evidente nas bases e nas regiões laterais. O ápice, contido na abertura superior do tórax, varia pouco. Ele não se afasta dos vasos como uma cortina que abre um corredor seguro.',
          'Lim et al. mediram por ultrassom, em 20 adultos em respiração espontânea, a distância entre a veia subclávia direita e a pleura. Com expiração completa, a distância do centro da veia à pleura praticamente não mudou (0,005 cm) e a da borda inferior diminuiu apenas 0,07 cm; a área de secção da veia aumentou pelo menos 14%. A expiração pode aumentar o alvo, mas não afasta a pleura.',
          'O espaço pleural normal é <em>virtual</em>: não há camada de ar separando pulmão e parede. Os dados de Lim et al. vêm de respiração espontânea; ventilação com pressão positiva, PEEP, enfisema e bolhas apicais não foram estudados ali.'
        ],
        keyPoints: [
          'Ápice e cúpula pouco se movem com a respiração.',
          'Expiração completa: veia maior (≥14% de área), distância à pleura praticamente igual.',
          'Espaço pleural normal é virtual.'
        ],
        pitfalls: [
          'Usar a expiração como “garantia” de afastamento pleural.',
          'Extrapolar dados de respiração espontânea para ventilação mecânica.'
        ],
        detail: 'O controle Expiração–Inspiração compara formas qualitativas; a amplitude foi escolhida para ensino e não representa um paciente. A película pleural está destacada apenas para visualização.',
        sources: [6],
        quiz: {
          q: 'Segundo Lim et al. (2013), o que a expiração completa produziu em adultos em respiração espontânea?',
          options: [
            'Aumento de cerca de 1 cm na distância veia–pleura',
            'Colapso da veia subclávia',
            'Deslocamento caudal da cúpula pleural',
            'Aumento da área da veia, sem afastamento relevante da pleura'
          ],
          answer: 3,
          explain: 'A área da veia aumentou ao menos 14%, mas a distância à pleura mudou só centésimos de centímetro: expiração não abre margem pleural.'
        },
        scene: {
          // alvo mais baixo e raio maior: o recesso costodiafragmático sai de baixo da legenda do visor
          // e a cúpula fica abaixo da barra de vistas (visor 885 × 605)
          view: { target: [4, -10.3, -4], radius: 66, az: -0.35, el: 0.12 },
          layers: ['bones', 'lung', 'pleura', 'vein', 'mediastinum', 'aids'],
          ghost: { bones: 0.2 },
          state: S({ breath: 0 }),
          clip: null,
          labels: [
            ['cupulaR', 'Cúpula pleural (pouco se move)'],
            ['lungBaseR', 'Base do pulmão D (move-se mais)'],
            ['horizontalFissureR', 'Fissura horizontal'],
            ['obliqueFissureR', 'Fissura oblíqua'],
            ['costophrenicR', 'Recesso costodiafragmático'],
            // sem rótulo próprio para o diafragma: sua âncora coincide na tela com a da base do pulmão
            ['scvR', 'Veia subclávia']
          ],
          highlight: 'pleura-R',
          anim: 'breath'
        },
        inset: null
      },

      /* ---------------------------------------------------------------- 12 */
      {
        id: 'distancias', n: '12', short: 'Distâncias',
        title: 'Distâncias, ombro e coxim: medidas que não se confundem',
        focus: 'Clavícula–veia, pele–veia e ponta–pleura são medidas diferentes — e todas mudam com a posição do ombro.',
        body: [
          'Clavícula–veia é o intervalo entre osso e vaso. Pele–veia depende da espessura e da compressão dos tecidos e da direção em que se mede. Comprimento de agulha é medido ao longo da haste. Nenhuma delas determina, sozinha, a distância entre ponta e pleura.',
          'Os estudos diferem porque mediram coisas diferentes. Em tomografia de 7 voluntários (Kitagawa et al.), a distância clavícula–veia foi 6,8 mm com o ombro elevado, 5,0 mm neutro e 3,6 mm abaixado (tracionado caudalmente), com maior sobreposição clavícula–veia no ombro abaixado; num ensaio com 30 pacientes, o sucesso foi maior com o ombro abaixado do que elevado. Em cadáveres (Tan et al.), elevar o ombro reduziu a sobreposição, leve retração aumentou o contato veia–clavícula e protração afastou a clavícula da veia.',
          'Coxins: em ressonância e dissecção, ombros retraídos e cabeça girada distorceram a anatomia da veia (Jesseph et al.); Bannon et al. descrevem compressão da veia entre a clavícula e a 1ª costela com rolo entre as escápulas. Em duplex de 10 voluntários (veia subclávia <em>esquerda</em>), arquear os ombros produziu o menor diâmetro (0,84 cm) e o Trendelenburg com cabeça e ombros neutros, o maior (0,99 cm) (Fortune & Feustel). Rolo interescapular e pequeno rolo sob o ombro ipsilateral são posições diferentes, não equivalentes.',
          'As recomendações não coincidem: Tan et al. sugerem ombros neutros com leve retração; Jesseph et al., cabeça e ombros neutros; Bannon et al. indicam Trendelenburg para enchimento venoso e menor risco de embolia gasosa, mas afirmam que ele não aumenta o calibre da subclávia. O documento-base usa o termo “tarô”, aqui entendido como coxim ou rolo de apoio sob o dorso. Como cada posição muda a relação clavícula–veia, marcos palpados antes de uma mudança de posição — e a janela ultrassonográfica, se disponível — podem não valer depois dela.'
        ],
        keyPoints: [
          'Três medidas: clavícula–veia, pele–veia e comprimento da haste — nenhuma é ponta–pleura.',
          'Kitagawa et al.: 6,8 / 5,0 / 3,6 mm com ombro elevado / neutro / abaixado.',
          'Retração acentuada (rolo interescapular) pode comprimir ou distorcer a veia.',
          'Cabeça e ombros neutros aparecem como ponto de partida em várias fontes.'
        ],
        pitfalls: [
          'Tratar médias de estudos como margem de segurança individual.',
          'Usar coxim para “afastar o pulmão” ou para medir profundidade.'
        ],
        detail: 'A cena mostra onde fica o rolo interescapular — a posição que Jesseph et al. e Bannon et al. associam a compressão ou distorção da veia —, mas mantém os ombros neutros: o modelo não simula a queda posterior dos ombros nem o estreitamento costoclavicular que o rolo provoca. O cilindro indica a localização do apoio, sem prescrever espessura; pele e ossos translúcidos deixam ver a veia passando entre a clavícula e a 1ª costela — o espaço que a retração dos ombros estreita.',
        sources: [1, 7, 8, 9, 10],
        quiz: {
          q: 'Em Kitagawa et al. (2004), o que aconteceu ao abaixar o ombro (tração caudal) em relação à posição neutra?',
          options: [
            'A distância clavícula–veia aumentou para cerca de 1 cm',
            'A distância clavícula–veia diminuiu (≈3,6 mm) e a sobreposição aumentou',
            'O diâmetro da veia dobrou',
            'A veia passou a ficar acima da clavícula'
          ],
          answer: 1,
          explain: 'Com o ombro abaixado, clavícula e veia ficaram mais próximas e mais sobrepostas, sem mudança do diâmetro venoso — e o sucesso clínico foi maior que com o ombro elevado. São médias de um estudo pequeno, não margens individuais.'
        },
        scene: {
          view: { target: [5, -3, -6], radius: 52, az: -1.15, el: 0.3 },
          layers: ['skin', 'bones', 'vein', 'aids'],
          // ossos translúcidos (onda 3): com ossos opacos, a clavícula encobria a veia e a 1ª costela nesta vista
          ghost: { skin: 0.15, bones: 0.45 },
          state: S({ rollMode: 'interscapular' }),
          clip: null,
          labels: [
            ['rollInterscapular', 'Rolo interescapular: pode comprimir a veia'],
            ['clavicleR', 'Clavícula'],
            ['scvLateralR', 'Veia subclávia (sobre a 1ª costela)'],
            ['firstRibR', '1ª costela'],
            ['acromionR', 'Acrômio']
          ],
          highlight: null,
          anim: null
        },
        inset: 'distances'
      },

      /* ---------------------------------------------------------------- 13 */
      {
        id: 'complicacoes', n: '13', short: 'Complicações',
        title: 'Complicações por estrutura: o que se lesa e como se reconhece',
        focus: 'Cada complicação mecânica tem uma estrutura vizinha “dona”; conhecê-la orienta prevenção, reconhecimento e escalonamento.',
        body: [
          'Comparação entre sítios: no ECR 3SITES (3.471 cateteres em UTI), a subclávia teve menos infecção de corrente sanguínea e trombose sintomática (1,5 evento por 1.000 cateter-dias, contra 3,6 na jugular e 4,6 na femoral, na comparação entre os três sítios), porém mais pneumotórax com drenagem (1,5% × 0,5% na jugular) (Parienti et al.). Numa revisão de estudos não randomizados, a via subclávia teve menos punção arterial (0,5% × 3,0%) e mais mau posicionamento (9,3% × 5,3%) que a jugular, sem diferença clara em hemo/pneumotórax (Ruesch et al.).',
          'Por estrutura: <strong>pleura</strong> (pneumotórax, hemotórax); <strong>artéria subclávia</strong> (punção arterial, hematoma de difícil compressão sob a clavícula, pseudoaneurisma); <strong>plexo braquial</strong> e <strong>frênico</strong> (lesão direta ou por hematoma); <strong>ducto torácico</strong> (quilotórax, sobretudo à esquerda); <strong>coração e pericárdio</strong> (arritmia pelo fio, perfuração, tamponamento); confluência venosa (mau posicionamento); a própria veia (trombose, infecção). A embolia gasosa ocorre com o sistema aberto e pressão intratorácica negativa: Bannon et al. recomendam o Trendelenburg, quando tolerado, também para reduzir esse risco; a outra medida descrita é manter o sistema fechado ao ar (canhão e vias ocluídos).',
          'As frequências variam muito com operador, população e uso de ultrassom. No grupo por marcos do ECR de Fragou et al. (pacientes ventilados), houve punção arterial em 5,4%, hemotórax em 4,4%, pneumotórax em 4,9%, lesão do plexo em 2,9%, do frênico em 1,5% e tamponamento em 0,5% — todas menores com ultrassom. Números de um centro não são estimativas universais.',
          'Nas descrições de ensino, sinais de alarme interrompem o procedimento para avaliação: ar aspirado, piora respiratória, dor torácica, parestesia, sangue pulsátil ou suspeita arterial, resistência inesperada, arritmia. Na suspeita de dilatador ou cateter em artéria, Guilbert et al. descrevem não removê-lo às cegas e acionar manejo especializado.'
        ],
        keyPoints: [
          'Subclávia × jugular: menos infecção/trombose, mais pneumotórax (3SITES).',
          'Menos punção arterial, mais mau posicionamento (revisão não randomizada).',
          'Cada complicação tem uma estrutura “dona”: pleura, artéria, plexo, frênico, ducto, coração.',
          'Sinal de alarme → interrupção, avaliação e escalonamento.'
        ],
        pitfalls: [
          'Generalizar taxas de um estudo para o próprio serviço.',
          'Retirar às cegas um dilatador ou cateter calibroso em artéria.'
        ],
        detail: 'Use “Ver no 3D” numa complicação da tabela (aqui ou no material complementar) para destacar a estrutura correspondente no modelo. A cena mostra a ponta na luz venosa e as estruturas em risco ao redor.',
        sources: [1, 12, 13, 14, 15, 21],
        quiz: {
          q: 'No ECR 3SITES, em comparação com a jugular interna, a via subclávia associou-se a:',
          options: [
            'Mais infecção e menos pneumotórax',
            'Ausência de pneumotórax',
            'Menos infecção/trombose sintomática e mais pneumotórax com drenagem',
            'Mais trombose e mais infecção'
          ],
          answer: 2,
          explain: 'Parienti et al. (2015): desfecho composto de infecção de corrente sanguínea e trombose sintomática menor com a subclávia; pneumotórax com drenagem em 1,5% × 0,5% na jugular.'
        },
        scene: {
          view: 'oblique',
          layers: ['bones', 'vein', 'artery', 'nerve', 'pleura', 'lung', 'instrument', 'aids'],
          ghost: { bones: 0.5 },
          state: S({ phase: 4 }),
          clip: null,
          labels: [
            ['needleTip', 'Ponta na luz venosa'],
            ['scaR', 'Artéria subclávia — punção arterial'],
            ['cupulaR', 'Cúpula pleural — pneumotórax'],
            ['plexusR', 'Plexo braquial — parestesia'],
            ['phrenicR', 'Frênico — paresia diafragmática'],
            ['scvR', 'Veia subclávia']
          ],
          highlight: null,
          anim: null
        },
        inset: 'complications'
      },

      /* ---------------------------------------------------------------- 14 */
      {
        id: 'ultrassom', n: '14', short: 'Ultrassom',
        title: 'Ultrassom e treino supervisionado',
        focus: 'O atlas treina a leitura espacial; a confirmação clínica depende de imagem em tempo real, supervisão e protocolo.',
        body: [
          'A clavícula produz sombra acústica e dificulta ver a subclávia propriamente dita. Por isso a abordagem guiada costuma ser <strong>infraclavicular e mais lateral</strong>, sobre a <strong>veia axilar</strong> antes de ela se tornar subclávia: em eixo curto, a veia é compressível e fica anterior à artéria, pulsátil e não compressível (Bannon et al.); a artéria aparece também cranial à veia, e a sobreposição entre elas diminui à medida que a janela se desloca lateralmente. Em 50 sujeitos (Galloway & Bodenham), do ponto médio da clavícula para cerca de 4 cm lateralmente, a profundidade pele–veia passou de 1,9 para 3,1 cm, o diâmetro caiu de 1,2 para 0,9 cm, a sobreposição artéria–veia diminuiu (mediana de 2/3 para nenhuma) e a distância veia–caixa torácica subiu de 1,0 para 2,0 cm.',
          'Evidência: no ECR de Fragou et al. (401 pacientes ventilados analisados, punção infraclavicular), o ultrassom em tempo real teve sucesso em 100% contra 87,5% por marcos, com menos tentativas e menos complicações. A meta-análise de Lalu et al. (10 ECR, 2.168 participantes) mostrou menos complicações com ultrassom (OR 0,53), com redução de punção arterial, pneumotórax e hematoma no subgrupo 2D dinâmico. A revisão Cochrane de Brass et al. (subclávia: 9 estudos) encontrou menos punção arterial (RR 0,21) e hematoma (RR 0,26), com evidência de baixa qualidade.',
          'O ponto de entrada e a trajetória da técnica por marcos não se transferem automaticamente para a abordagem axilar guiada. Ver a ponta continuamente é diferente de marcar a pele após um exame: localizar a veia sem orientação em tempo real não melhorou sucesso nem complicações (Bannon et al.).',
          'No treino supervisionado, a lista de verificação abaixo permite ao preceptor avaliar cada item separadamente. O arquivo não certifica competência nem substitui simulação com feedback.'
        ],
        keyPoints: [
          'Sombra da clavícula: a janela guiada costuma ser lateral, na veia axilar.',
          'Veia compressível; artéria pulsátil, posterior e cranial a ela — menos sobreposta quanto mais lateral a janela.',
          'Ultrassom em tempo real: menos complicações (Fragou; Lalu — 2D dinâmico) e menos punção arterial e hematoma, com evidência de baixa qualidade (Brass).',
          'Marcar a pele ≠ guiar em tempo real.'
        ],
        pitfalls: [
          'Transferir o ponto de entrada da técnica por marcos para a técnica axilar guiada.',
          'Perder a ponta de vista e continuar avançando.'
        ],
        detail: 'Uso educacional para profissionais e simulação supervisionada. Modelo sintético, sem reconstrução de tomografia e sem validação metrológica ou clínica.',
        sources: [1, 15, 16, 17, 18],
        quiz: {
          q: 'Por que a punção guiada por ultrassom na região infraclavicular costuma mirar a veia axilar, mais lateral?',
          options: [
            'Porque a veia axilar é mais superficial que a subclávia',
            'Porque a clavícula produz sombra acústica que dificulta visualizar a subclávia',
            'Porque a artéria axilar fica à frente da veia',
            'Porque não há pleura sob essa região'
          ],
          answer: 1,
          explain: 'A sombra da clavícula limita a janela. Lateralmente a veia é até mais profunda (Galloway & Bodenham), a artéria fica posterior e cranial a ela, e a caixa torácica, com a pleura, continua por baixo — só que mais distante.'
        },
        scene: {
          // vista quase frontal e mais próxima (onda 3). Sem rótulos do peitoral menor (o músculo translúcido não
          // aparece sob o fantasma por Fresnel: a âncora caía sobre as costelas) nem do coracoide (a ponta, pequena,
          // projeta-se sobre os vasos e não se distingue); a clavícula entra como a origem da sombra acústica
          view: { target: [11.2, -2.2, -0.6], radius: 24, az: -0.15, el: 0.12 },
          layers: ['bones', 'muscle', 'vein', 'artery', 'nerve', 'pleura', 'aids'],
          ghost: { muscle: 0.3 },
          state: S(),
          clip: null,
          labels: [
            ['axillaryVR', 'Veia axilar (alvo guiado)'],
            ['axillaryAR', 'Artéria axilar (posterior e cranial)'],
            ['cephalicR', 'Veia cefálica'],
            ['clavicleR', 'Clavícula (sombra acústica)'],
            ['scvLateralR', 'Transição axilar → subclávia (borda lateral da 1ª costela)']
          ],
          highlight: 'axillary-v-R',
          anim: null
        },
        inset: 'usg'
      }
    ],

    glossary: G,

    /* ---------------- Fontes (verificação: PubMed, 19/11/2026) ---------------- */
    sources: [
      { n: 1, title: 'Anatomic considerations for central venous cannulation',
        detail: 'Bannon MP, Heller SF, Rivera M. Risk Manag Healthc Policy. 2011;4:27–39. PMID 22312225; PMCID PMC3270925; DOI 10.2147/RMHP.S10383. Texto completo lido nesta revisão.',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3270925/' },
      { n: 2, title: 'Anatomy, Thorax, Subclavian Veins (StatPearls)',
        detail: 'NCBI Bookshelf, NBK532885. Mantida do original como leitura anatômica geral; não reacessada nesta revisão (acesso de rede indisponível) e não sustenta números do atlas.',
        url: 'https://www.ncbi.nlm.nih.gov/books/NBK532885/' },
      { n: 3, title: 'How to do infraclavicular subclavian vein cannulation — landmark-guided',
        detail: 'MSD Manual Professional. Mantida do original como leitura complementar; não reacessada nesta revisão e não sustenta números do atlas — confira a versão vigente.',
        url: 'https://www.msdmanuals.com/professional/critical-care-medicine/how-to-do-central-vascular-procedures/how-to-do-infraclavicular-subclavian-vein-cannulation-landmark-guided' },
      { n: 4, title: 'How to do infraclavicular subclavian vein cannulation — ultrasound-guided',
        detail: 'MSD Manual Professional. Mantida do original como leitura complementar; não reacessada nesta revisão — confira a versão vigente.',
        url: 'https://www.msdmanuals.com/professional/critical-care-medicine/how-to-do-central-vascular-procedures/how-to-do-infraclavicular-subclavian-vein-cannulation-ultrasound-guided' },
      { n: 5, title: 'Videos in clinical medicine. Central venous catheterization — subclavian vein',
        detail: 'Braner DAV, Lai S, Eman S, Tegtmeyer K. N Engl J Med. 2007;357(24):e26. PMID 18077803; DOI 10.1056/NEJMvcm074357. Metadados verificados; o conteúdo do vídeo não foi reassistido — as descrições a ele atribuídas vêm do documento-base.',
        url: 'https://doi.org/10.1056/NEJMvcm074357' },
      { n: 6, title: 'The effect of full expiration on the position and size of the subclavian vein in spontaneously breathing adults',
        detail: 'Lim KJ, Lee JM, Byon HJ, et al. Anesth Analg. 2013;117(1):109–13. PMID 22763901; DOI 10.1213/ANE.0b013e31826257f4. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/22763901/' },
      { n: 7, title: 'Proper shoulder position for subclavian venipuncture: a prospective randomized clinical trial and anatomical perspectives using multislice computed tomography',
        detail: 'Kitagawa N, Oda M, Totoki T, et al. Anesthesiology. 2004;101(6):1306–12. PMID 15564937; DOI 10.1097/00000542-200412000-00010. Resumo verificado (o original atribuía o estudo ao Am J Surg — corrigido).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/15564937/' },
      { n: 8, title: 'Anatomic basis of safe percutaneous subclavian venous catheterization',
        detail: 'Tan BK, Hong SW, Huang MH, Lee ST. J Trauma. 2000;48(1):82–6. PMID 10647570; DOI 10.1097/00005373-200001000-00014. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/10647570/' },
      { n: 9, title: 'Effect of patient position on size and location of the subclavian vein for percutaneous puncture',
        detail: 'Fortune JB, Feustel P. Arch Surg. 2003;138(9):996–1000. PMID 12963658; DOI 10.1001/archsurg.138.9.996. Resumo verificado (veia subclávia esquerda, 10 voluntários).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12963658/' },
      { n: 10, title: 'Patient positioning for subclavian vein catheterization',
        detail: 'Jesseph JM, Conces DJ, Augustyn GT. Arch Surg. 1987;122(10):1207–9. PMID 3662802; DOI 10.1001/archsurg.1987.01400220117023. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/3662802/' },
      { n: 11, title: 'Avoiding common technical errors in subclavian central venous catheter placement',
        detail: 'Kilbourne MJ, Bochicchio GV, Scalea T, Xiao Y. J Am Coll Surg. 2009;208(1):104–9. PMID 19228511; DOI 10.1016/j.jamcollsurg.2008.09.025. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/19228511/' },
      { n: 12, title: 'Preventing complications of central venous catheterization',
        detail: 'McGee DC, Gould MK. N Engl J Med. 2003;348(12):1123–33. PMID 12646670; DOI 10.1056/NEJMra011883. Revisão; metadados verificados (sem resumo no PubMed) — citada como leitura geral, sem números extraídos.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12646670/' },
      { n: 13, title: 'Complications of central venous catheters: internal jugular versus subclavian access — a systematic review',
        detail: 'Ruesch S, Walder B, Tramèr MR. Crit Care Med. 2002;30(2):454–60. PMID 11889329; DOI 10.1097/00003246-200202000-00031. Resumo verificado (17 estudos prospectivos não randomizados).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/11889329/' },
      { n: 14, title: 'Intravascular complications of central venous catheterization by insertion site (3SITES)',
        detail: 'Parienti JJ, Mongardon N, Mégarbane B, et al.; 3SITES Study Group. N Engl J Med. 2015;373(13):1220–9. PMID 26398070; DOI 10.1056/NEJMoa1500964. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/26398070/' },
      { n: 15, title: 'Real-time ultrasound-guided subclavian vein cannulation versus the landmark method in critical care patients: a prospective randomized study',
        detail: 'Fragou M, Gravvanis A, Dimitriou V, et al. Crit Care Med. 2011;39(7):1607–12. PMID 21494105; DOI 10.1097/CCM.0b013e318218a1ae. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/21494105/' },
      { n: 16, title: 'Ultrasound-guided subclavian vein catheterization: a systematic review and meta-analysis',
        detail: 'Lalu MM, Fayad A, Ahmed O, et al. Crit Care Med. 2015;43(7):1498–507. PMID 25803646; DOI 10.1097/CCM.0000000000000973. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25803646/' },
      { n: 17, title: 'Ultrasound guidance versus anatomical landmarks for subclavian or femoral vein catheterization',
        detail: 'Brass P, Hellmich M, Kolodziej L, Schick G, Smith AF. Cochrane Database Syst Rev. 2015;1:CD011447. PMID 25575245; DOI 10.1002/14651858.CD011447. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/25575245/' },
      { n: 18, title: 'Ultrasound imaging of the axillary vein — anatomical basis for central venous access',
        detail: 'Galloway S, Bodenham A. Br J Anaesth. 2003;90(5):589–95. PMID 12697585; DOI 10.1093/bja/aeg094. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/12697585/' },
      { n: 19, title: 'The carina as a radiological landmark for central venous catheter tip position',
        detail: 'Stonelake PA, Bodenham AR. Br J Anaesth. 2006;96(3):335–40. PMID 16415318; DOI 10.1093/bja/aei310. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/16415318/' },
      { n: 20, title: 'Eliminating arterial injury during central venous catheterization using manometry',
        detail: 'Ezaru CS, Mangione MP, Oravitz TM, Ibinson JW, Bjerke RJ. Anesth Analg. 2009;109(1):130–4. PMID 19377052; DOI 10.1213/ane.0b013e31818f87e9. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/19377052/' },
      { n: 21, title: 'Arterial trauma during central venous catheter insertion: case series, review and proposed algorithm',
        detail: 'Guilbert MC, Elkouri S, Bracco D, et al. J Vasc Surg. 2008;48(4):918–25. PMID 18703308; DOI 10.1016/j.jvs.2008.04.046. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/18703308/' },
      { n: 22, title: 'Randomized comparison of three guidewire insertion depths on incidence of arrhythmia during central venous catheterization',
        detail: 'Lee JM, Lee J, Hwang JY, et al. Am J Emerg Med. 2017;35(5):743–8. PMID 28132796; DOI 10.1016/j.ajem.2017.01.016. Resumo verificado (via jugular interna direita).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/28132796/' },
      { n: 23, title: 'Anatomical variations in distal portion of the thoracic duct — a systematic review',
        detail: 'Bellier A, Pardo Vargas JS, Cassiba J, et al. Clin Anat. 2020;33(1):99–107. PMID 31576619; DOI 10.1002/ca.23476. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/31576619/' },
      { n: 24, title: 'CT anatomy of the internal mammary vessels: importance in planning percutaneous transthoracic procedures',
        detail: 'Glassberg RM, Sussman SK, Glickstein MF. AJR Am J Roentgenol. 1990;155(2):397–400. PMID 2115273; DOI 10.2214/ajr.155.2.2115273. Resumo verificado.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/2115273/' },
      { n: 25, title: 'Practice guidelines for central venous access 2020: an updated report by the American Society of Anesthesiologists Task Force on Central Venous Access',
        detail: 'Anesthesiology. 2020;132(1):8–43. PMID 31821240; DOI 10.1097/ALN.0000000000002864. Metadados verificados; texto não reacessado — leitura recomendada, sem afirmações extraídas.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/31821240/' },
      { n: 26, title: 'Direction of the J-tip of the guidewire, in Seldinger technique, is a significant factor in misplacement of subclavian vein catheter: a randomized, controlled study',
        detail: 'Tripathi M, Dubey PK, Ambesh SP. Anesth Analg. 2005;100(1):21–4. PMID 15616046; DOI 10.1213/01.ANE.0000139349.40278.77. Resumo verificado (20/11/2026; ECR duplo-cego, subclávia direita, 147 × 148 pacientes).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/15616046/' }
    ],

    /* ---------------- Medidas publicadas (com ressalvas) ---------------- */
    measurements: [
      { label: 'Distância clavícula–veia por posição do ombro', value: '6,8 mm (elevado) · 5,0 mm (neutro) · 3,6 mm (abaixado)',
        note: 'TC multislice, 7 voluntários. Sobreposição clavícula–veia 33,5% / 36,9% / 40,0%. Médias do estudo, não metas nem margens individuais.', source: [7] },
      { label: 'Distância veia–clavícula por duplex', value: '0,94 cm (supino, neutro; maior) · 0,75 cm (Trendelenburg + cabeça contralateral + ombros arqueados; menor)',
        note: 'Veia subclávia esquerda, 10 voluntários; método e ponto de medida diferentes dos da TC — não comparar diretamente.', source: [9] },
      { label: 'Diâmetro da veia subclávia por posição', value: '0,99 cm (Trendelenburg, cabeça e ombros neutros) · 0,84 cm (ombros arqueados)',
        note: 'Mesmo estudo (veia esquerda). Kitagawa et al. não encontraram diferença de diâmetro entre posições do ombro na TC.', source: [9, 7] },
      { label: 'Expiração completa × fim da inspiração', value: 'Distância centro da veia–pleura: +0,005 cm · borda inferior–pleura: −0,07 cm · área da veia: ≥ +14%',
        note: 'Ultrassom, 20 adultos em respiração espontânea, posição horizontal. Não se aplica diretamente à ventilação mecânica.', source: [6] },
      { label: 'Espessura do escaleno anterior', value: '≈ 1–1,5 cm',
        note: 'Valor citado em revisão anatômica; o músculo protege a artéria apenas enquanto o trajeto não é dirigido para trás.', source: [1] },
      { label: 'Veia axilar infraclavicular: profundidade pele–veia', value: '1,9 cm (0,7–3,7) sob o ponto médio da clavícula → 3,1 cm (1,1–5,6) cerca de 4 cm lateralmente',
        note: 'Ultrassom, 50 sujeitos; amplitude muito grande entre indivíduos.', source: [18] },
      { label: 'Veia axilar infraclavicular: diâmetro e relações', value: 'Diâmetro 1,2 → 0,9 cm · distância artéria–veia 0,3 → 0,8 cm · veia–caixa torácica 1,0 → 2,0 cm (medial → lateral)',
        note: 'Mesmo estudo; braço em 0°, 45° e 90° de abdução avaliados.', source: [18] },
      { label: 'Distância pele → junção cava–átrio pelo fio-guia', value: '18,4 cm (subclávia D) · 16,0 cm (jugular interna D) · 19,1 cm (jugular interna E) · 21,2 cm (subclávia E)',
        note: 'Médias fluoroscópicas citadas em revisão; a posição da ponta só se confirma por imagem.', source: [1] },
      { label: 'Ângulo traqueobrônquico direito × junção cavoatrial', value: 'ao menos 2,9 cm acima da junção',
        note: 'Dado citado em revisão como base para manter a ponta extracardíaca; referência radiográfica, não medida individual.', source: [1] },
      { label: 'Artéria torácica interna × borda do esterno', value: '1,57 ± 0,30 cm (D) · 1,47 ± 0,30 cm (E); veia torácica interna ≈ 1,0 cm',
        note: 'TC, 100 exames; em 9 pacientes a artéria estava a mais de 2 cm da borda esternal.', source: [24] },
      { label: 'Terminação do ducto torácico', value: 'Jugular interna E ≈ 54% · ângulo jugulossubclávio ≈ 26% · subclávia E ≈ 8% · outras ≈ 12%',
        note: 'Revisão sistemática, 1.352 ductos de estudos heterogêneos.', source: [23] }
    ],

    /* ---------------- Complicações por estrutura ---------------- */
    complications: [
      { name: 'Pneumotórax', structure: 'pleura-R',
        mechanism: 'Ponta além do plano venoso, sobretudo com a ponta angulada para trás (seringa levantada) ou caudalmente; medialmente, a veia apoia-se na pleura apical.',
        recognition: 'Ar aspirado, dispneia, dor torácica, tosse, queda da saturação; pode não ser imediato — a confirmação é por imagem, conforme protocolo.',
        prevention: 'Conjunto paralelo ao plano coronal sob a clavícula e entrada afastada da clavícula (Bannon et al.); recuo ao plano superficial antes de redirecionar; ultrassom, quando disponível (Fragou et al.).',
        incidence: '1,5% com drenagem (subclávia) × 0,5% (jugular) no 3SITES; 4,9% no grupo por marcos de Fragou et al.',
        source: [1, 14, 15] },
      { name: 'Punção arterial / hematoma', structure: 'sca-R',
        mechanism: 'Trajeto dirigido para trás (atrás do escaleno) ou lateral à 1ª costela, onde a artéria fica logo atrás da veia sem músculo interposto.',
        recognition: 'Sangue pulsátil ou vermelho-vivo — sinais não confiáveis isoladamente; a confirmação descrita é por manometria (Ezaru et al.), transdução ou ultrassom.',
        prevention: 'Direção logo acima da incisura jugular, sem trajeto dirigido para trás (Bannon et al.); confirmação venosa objetiva antes de dilatar (Ezaru et al.); ultrassom (Fragou et al.).',
        incidence: '0,5% (subclávia) × 3,0% (jugular) em estudos não randomizados; 5,4% no grupo por marcos de Fragou et al.',
        source: [1, 13, 15, 20] },
      { name: 'Canulação arterial com dilatador/cateter', structure: 'sca-R',
        mechanism: 'Dilatação após punção arterial não reconhecida.',
        recognition: 'Fluxo pulsátil pelo cateter, curva de pressão arterial, gasometria/imagem.',
        prevention: 'Confirmação venosa objetiva antes de dilatar — nenhuma lesão em 9.348 cateteres com manometria obrigatória (Ezaru et al.).',
        incidence: 'Sem estimativa generalizável. Guilbert et al.: retirada com compressão → complicações maiores em 8/17 (47%) na revisão da literatura e em 5/5 na série própria; reparo imediato → nenhuma (0/13 cirúrgico na revisão; 0/8 aberto ou endovascular na série).',
        source: [20, 21] },
      { name: 'Hemotórax', structure: 'pleura-R',
        mechanism: 'Lesão vascular (artéria ou veia) associada a ruptura pleural.',
        recognition: 'Instabilidade hemodinâmica, derrame novo na imagem, queda de hemoglobina.',
        prevention: 'As mesmas da punção arterial e do pneumotórax.',
        incidence: '4,4% no grupo por marcos de Fragou et al. (pacientes ventilados).',
        source: [15] },
      { name: 'Lesão do plexo braquial', structure: 'brachial-plexus-R',
        mechanism: 'Trajeto posterior e cranial. Lesão direta é improvável; o hematoma de uma punção arterial pode causar neuropatia compressiva (Bannon et al.).',
        recognition: 'Parestesia ou dor irradiada para o membro durante a punção; déficit posterior.',
        prevention: 'Nas descrições de ensino, interrupção imediata diante de parestesia; trajeto não dirigido para trás (Bannon et al.).',
        incidence: '2,9% no grupo por marcos de Fragou et al.',
        source: [1, 15] },
      { name: 'Lesão do nervo frênico', structure: 'phrenic-R',
        mechanism: 'Agulha profunda sobre a face anterior do escaleno anterior ou medialmente, onde o frênico passa entre artéria e veia.',
        recognition: 'Elevação da hemicúpula diafragmática, dispneia, dificuldade de desmame.',
        prevention: 'Trajeto que não ultrapassa a veia; ultrassom (Fragou et al.).',
        incidence: '1,5% no grupo por marcos de Fragou et al.',
        source: [1, 15] },
      { name: 'Quilotórax / fístula linfática', structure: 'thoracic-duct',
        mechanism: 'Lesão do ducto torácico na confluência venosa esquerda (terminação variável).',
        recognition: 'Derrame pleural leitoso; triglicerídeos elevados no líquido.',
        prevention: 'Relevante sobretudo nos acessos à esquerda; à direita chega apenas o ducto linfático direito.',
        source: [23] },
      { name: 'Embolia gasosa', structure: 'svc',
        mechanism: 'Entrada de ar pela agulha, canhão ou cateter abertos durante a inspiração (pressão intratorácica negativa).',
        recognition: 'Dispneia súbita, hipotensão, hipoxemia, alteração neurológica.',
        prevention: 'Trendelenburg, quando tolerado (Bannon et al.); canhão e vias ocluídos, sem sistema aberto ao ar.',
        source: [1] },
      { name: 'Arritmia induzida pelo fio-guia', structure: 'heart',
        mechanism: 'Fio longo alcançando átrio ou ventrículo direitos.',
        recognition: 'Extrassístoles ou taquiarritmias no monitor durante a passagem do fio.',
        prevention: 'Monitorização; fio introduzido só o necessário (Lee et al.); recuo do fio diante de arritmia.',
        incidence: 'Via jugular interna D (ECR, 69 pacientes): arritmia durante a dilatação em 65% com 20 cm × 26% com 15 cm de fio.',
        source: [22] },
      { name: 'Mau posicionamento (jugular interna, contralateral, ázigo)', structure: 'ijv-R',
        mechanism: 'Curva quase em ângulo reto da confluência direita; rotação contralateral da cabeça pode favorecer a subida para a jugular.',
        recognition: 'Imagem de controle; dificuldade de aspirar; curva de pressão inadequada.',
        prevention: 'Fio sem força; ponta em J voltada caudalmente (Tripathi et al.); cabeça em posição neutra; posição da ponta confirmada por imagem.',
        incidence: '9,3% (subclávia) × 5,3% (jugular) em estudos não randomizados; para a jugular interna, 2% com o J caudal × 40% com o J cranial num ECR pela subclávia direita (Tripathi et al.).',
        source: [1, 13, 26] },
      { name: 'Perfuração venosa / tamponamento', structure: 'pericardium',
        mechanism: 'Dilatador rígido avançado além da profundidade da veia, ou ponta de cateter dentro do coração/apoiada na parede.',
        recognition: 'Hipotensão, derrame pericárdico ou mediastinal, refluxo ausente após dilatação.',
        prevention: 'Dilatador só até a profundidade da veia; ponta na cava distal, paralela à parede (Bannon et al.).',
        incidence: 'Tamponamento em 0,5% no grupo por marcos de Fragou et al.',
        source: [1, 15, 19] },
      { name: 'Infecção e trombose relacionadas ao cateter', structure: 'scv-R',
        mechanism: 'Colonização do cateter; trauma endotelial e estase.',
        recognition: 'Febre, sinais locais, hemoculturas; edema do membro.',
        prevention: 'Clorexidina e barreira estéril máxima (Bannon et al.); retirada do cateter quando deixa de ser necessário.',
        incidence: '1,5 (subclávia) × 3,6 (jugular) × 4,6 (femoral) eventos/1.000 cateter-dias no desfecho composto do 3SITES.',
        source: [1, 14] },
      { name: 'Pinch-off (cateteres de longa permanência)', structure: 'costoclavicular-lig-R',
        mechanism: 'Compressão do cateter entre clavícula e 1ª costela, mais provável com punção medial.',
        recognition: 'Dificuldade intermitente de infundir/aspirar que muda com a posição do braço; estreitamento na radiografia.',
        prevention: 'Punção não muito medial em cateteres de longa permanência (Bannon et al.).',
        incidence: '1–5% em cateteres de longa permanência (dado citado em revisão).',
        source: [1] }
    ],

    /* ---------------- Tecidos atravessados (superficial → profundo) ---------------- */
    layersTable: [
      { depth: 1, tissue: 'Pele', note: 'Local da anestesia e, depois, da pequena incisão para o dilatador.' },
      { depth: 2, tissue: 'Tela subcutânea', note: 'Espessura muito variável — principal fonte de variação da profundidade pele–veia.' },
      { depth: 3, tissue: 'Fáscia peitoral e músculo peitoral maior (parte clavicular)', note: 'Fibras que descem da clavícula ao úmero; espessura dependente do biotipo.' },
      { depth: 4, tissue: 'Fáscia clavipeitoral', note: 'Envolve subclávio e peitoral menor; atravessada pela veia cefálica, vasos toracoacromiais e nervo peitoral lateral.' },
      { depth: 5, tissue: 'Músculo subclávio', note: 'Logo sob a clavícula; a agulha passa através dele (Bannon et al.). O periósteo da clavícula fica acima — atravessá-lo é erro descrito.' },
      { depth: 6, tissue: 'Tecido fibroso que suspende a veia', note: 'Adventícia ligada ao periósteo, ao ligamento costoclavicular e às fáscias do subclávio e do escaleno anterior.' },
      { depth: 7, tissue: 'Parede anterior da veia subclávia → luz', note: 'Sobre a 1ª costela, anterior ao escaleno anterior. Na técnica descrita, o avanço termina aqui.' },
      { depth: 8, tissue: 'Além da veia (estruturas em risco)', note: 'Sobre a costela: escaleno anterior com o frênico, artéria subclávia, plexo. Medialmente: frênico, artéria torácica interna e pleura apical.' }
    ],

    /* ---------------- Treino supervisionado: o que o preceptor avalia ---------------- */
    checklist: [
      'Discute indicação, alternativas de sítio (incluindo a abordagem guiada por ultrassom) e condições que desaconselham a via subclávia.',
      'Prepara: assepsia com clorexidina, barreira estéril máxima, monitorização e material de resgate.',
      'Posiciona com cabeça e ombros neutros, justifica qualquer coxim ou Trendelenburg e reavalia os marcos após mudanças.',
      'Identifica incisura jugular, clavícula, junção dos terços e a região de entrada (1–2 cm inferior e lateral).',
      'Usa a mão esquerda corretamente: indicador como referência de direção, polegar em pressão suave que mantém o conjunto rente sob a clavícula, demais dedos fora da trajetória.',
      'Distingue direção (plano frontal) de inclinação (vista pela cabeceira) e mantém o conjunto o mais paralelo possível ao plano coronal sob a clavícula.',
      'Diante de contato ósseo ou ausência de refluxo: para, recua ao plano superficial e reavalia — não aprofunda.',
      'Estabiliza a agulha ao refluxo e não perde a veia na troca seringa → fio.',
      'Confirma a posição venosa por método objetivo antes de dilatar.',
      'Avança o fio sem força, reconhece resistência e arritmia e considera o desvio para a jugular interna.',
      'Limita o dilatador à profundidade da veia e confirma a ponta do cateter por imagem antes do uso.',
      'Reconhece sinais de alarme (ar, dispneia, dor, parestesia, sangue pulsátil), interrompe e escalona; não retira às cegas cateter calibroso em artéria.'
    ],

    /* ---------------- Ultrassom esquemático (infraclavicular lateral, eixo curto) ---------------- */
    usg: {
      caption: 'Esquema da janela infraclavicular lateral, em eixo curto sobre a veia axilar (cranial à esquerda). Do superficial ao profundo: pele e subcutâneo, peitoral maior, peitoral menor; a veia axilar (compressível) e, cranial e posterior a ela, a artéria axilar (pulsátil, não compressível), com fascículos do plexo ao redor da artéria — a sobreposição entre os vasos diminui à medida que a janela se desloca lateralmente (Galloway & Bodenham). Mais fundo, costela com sombra acústica e linha pleural. Na técnica guiada em tempo real, a agulha avança com a ponta visível na tela.',
      labels: [
        { key: 'skin', text: 'Pele e subcutâneo' },
        { key: 'pecMajor', text: 'Peitoral maior' },
        { key: 'pecMinor', text: 'Peitoral menor' },
        { key: 'vein', text: 'Veia axilar (compressível)' },
        { key: 'artery', text: 'Artéria axilar (pulsátil; cranial e posterior à veia)' },
        { key: 'plexus', text: 'Fascículos do plexo braquial' },
        { key: 'rib', text: 'Costela com sombra acústica' },
        { key: 'pleura', text: 'Linha pleural' },
        { key: 'needle', text: 'Ponta da agulha (visível em tempo real)' }
      ]
    },

    /* ---------------- Prancha (foto sintética, data/prancha.jpg) ---------------- */
    prancha: {
      title: 'Mão esquerda: indicador na incisura, polegar infraclavicular',
      caption: 'Prancha sintética de apoio ao capítulo “Mão esquerda”. O lado direito do paciente aparece à esquerda da imagem.',
      notes: [
        'Ilustração gerada sinteticamente — não é fotografia de paciente nem de procedimento real; não mostra assepsia, campos completos nem anestesia.',
        'Posições aproximadas: a polpa do indicador repousa junto à incisura jugular, na extremidade medial da clavícula; a do polegar deprime a pele abaixo da clavícula, mais lateralmente; os demais dedos ficam fletidos.',
        'A imagem não mede força nem profundidade. Compare com a cena 3D do capítulo “Mão esquerda”, em que a mão é articulada e pode ser animada.',
        'Nesta foto, o polegar e a região de entrada estão mais laterais que no modelo 3D: estimados pelo traçado da clavícula, o polegar fica ≈3 cm e a elipse ≈4 cm lateral à junção dos terços (J). No modelo, o polegar apoia-se logo abaixo da junção e o anel de entrada fica ≈2,5 cm lateral a ela.'
      ],
      // slot: posição da marcação na foto (index/thumb/clavicle/entry). O texto da 4ª não cita indicador, polegar
      // nem clavícula, porque a interface também escolhe a posição por palavras-chave do texto
      annotations: [
        { n: 1, slot: 'index', text: 'Polpa do indicador junto à incisura jugular — referência de direção.' },
        { n: 2, slot: 'thumb', text: 'Polpa do polegar em apoio infraclavicular — pressão suave, que ajuda a manter o conjunto rente sob a clavícula.' },
        { n: 3, slot: 'clavicle', text: 'Traçado aproximado da clavícula direita; a junção dos terços medial e médio (J) é a referência de entrada.' },
        { n: 4, slot: 'entry', text: 'Região ilustrativa de entrada, inferior e lateral à junção dos terços (J) — nesta foto, mais lateral que no modelo 3D; não é coordenada.' }
      ]
    },

    /* ---------------- Assimetria direita × esquerda ---------------- */
    asymmetry: [
      { topic: 'Veia braquiocefálica', right: 'Curta e quase vertical', left: 'Longa e oblíqua; cruza a linha média à frente dos ramos do arco aórtico' },
      { topic: 'Trajeto subclávia → veia cava superior', right: 'Curva acentuada, quase em ângulo reto, ao receber a jugular interna (Bannon et al.)', left: 'Arco suave pela braquiocefálica esquerda (Bannon et al.)' },
      { topic: 'Mau posicionamento', right: 'Desvio para a jugular interna ou para o lado oposto na curva da confluência (Bannon et al.); ponta em ângulo agudo com a parede, rara (4/163; Stonelake & Bodenham)', left: 'Ponta acima da carina muitas vezes subótima — alta (9/43) ou em ângulo agudo com a parede (27/43); abaixo da carina, posição mais satisfatória (Stonelake & Bodenham)' },
      { topic: 'Introdutores e cateteres rígidos', right: 'A curva favorece dobra do introdutor e lesão da parede (Bannon et al.)', left: 'Trajeto considerado mais favorável por Bannon et al.' },
      { topic: 'Pele → junção cava–átrio (média fluoroscópica citada por Bannon et al.)', right: '18,4 cm', left: '21,2 cm' },
      { topic: 'Artéria subclávia', right: 'Nasce do tronco braquiocefálico, atrás da articulação esternoclavicular', left: 'Nasce diretamente do arco aórtico' },
      { topic: 'Linfáticos na confluência', right: 'Ducto linfático direito (curto)', left: 'Ducto torácico: jugular interna (≈54%), ângulo (≈26%) ou subclávia (≈8%) — risco de quilotórax (Bellier et al.)' },
      { topic: 'Nervo laríngeo recorrente', right: 'Contorna a artéria subclávia direita (alça cervical)', left: 'Contorna o arco aórtico (alça torácica)' },
      { topic: 'Pulmão', right: 'Três lobos (fissuras horizontal e oblíqua)', left: 'Dois lobos; incisura cardíaca e língula' }
    ],

    glossaryGroups: ['Ossos', 'Veias', 'Artérias', 'Músculos', 'Nervos', 'Linfáticos', 'Pulmões e pleura', 'Mediastino', 'Pele e superfície', 'Instrumentos']
  };
})();
