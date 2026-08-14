import type { AppLocale } from "@/i18n/config";

export type AgreementClause = {
  n: string;
  en: string;
  ru: string;
  items?: Array<{ key: string; en: string; ru: string }>;
};

export type AgreementArticle = {
  roman: string;
  title: { en: string; ru: string };
  clauses: AgreementClause[];
};

export const CONSULTING_AGREEMENT_BRAND = {
  letters: "S P I O R A",
  slogan: "ONE PLATFORM. INFINITE SOLUTIONS.",
  program: {
    en: "DIGITAL NOMAD PROGRAMME",
    ru: "ПРОГРАММА «ЦИФРОВОЙ КОЧЕВНИК»",
  },
  title: {
    en: "CONSULTING SERVICES AGREEMENT",
    ru: "ДОГОВОР О КОНСУЛЬТАЦИОННЫХ УСЛУГАХ",
  },
  providerLegalName: {
    en: "SPIORA Technologies, limited liability company",
    ru: "Общество с ограниченной ответственностью «СПИОРА Технолоджиз»",
  },
};

export const CONSULTING_AGREEMENT_ARTICLES: AgreementArticle[] = [
  {
    roman: "I",
    title: { en: "SUBJECT MATTER OF THE AGREEMENT", ru: "ПРЕДМЕТ ДОГОВОРА" },
    clauses: [
      {
        n: "1",
        en: 'Under this Agreement, the Provider undertakes to render consulting, informational and other services related to the preparation of the documents required to obtain a temporary residence permit under the "Digital Nomad" programme (hereinafter — the "Permit"), as well as to provide assistance with the filing of the application for such Permit.',
        ru: "Исполнитель по настоящему Договору обязуется оказывать консультационные, информационные и иные услуги, связанные с подготовкой документов, необходимых для получения разрешения на временное пребывание в рамках программы «Цифровой кочевник» (далее – «Разрешение»), а также с оказанием содействия в подаче заявления на его получение.",
      },
      {
        n: "2",
        en: "The Provider's services shall include, in particular but not exclusively, the following actions:",
        ru: "Услуги Исполнителя, в частности, но не исключительно, включают в себя следующие действия:",
        items: [
          {
            key: "a",
            en: "preliminary assessment of the Client's situation and verification of the Client's compliance with the eligibility conditions of the programme;",
            ru: "предварительная оценка ситуации Клиента и проверка выполнения им условий участия в программе;",
          },
          {
            key: "b",
            en: "compilation of the list of documents required for the filing of the Permit application;",
            ru: "составление перечня документов, необходимых для подачи заявления на получение Разрешения;",
          },
          {
            key: "c",
            en: "provision of specimens of the required documents (forms, applications, declarations) and assistance in their preparation;",
            ru: "предоставление образцов необходимых документов (формуляров, заявлений, деклараций) и содействие при их подготовке;",
          },
          {
            key: "d",
            en: "review of the Client's documents from a formal and substantive standpoint, and formulation of recommendations for their amendment and supplementation;",
            ru: "проверка документов Клиента с формальной и содержательной точки зрения, формулирование рекомендаций по их изменению и дополнению;",
          },
          {
            key: "e",
            en: "informing the Client of the method, place and deadlines for filing the application;",
            ru: "информирование Клиента о способе, месте и сроках подачи заявления;",
          },
          {
            key: "f",
            en: "provision of information on the general procedure and the course of the relevant administrative proceedings.",
            ru: "предоставление информации об общем порядке и ходе соответствующей административной процедуры.",
          },
        ],
      },
      {
        n: "3",
        en: "The Provider undertakes to act with due professional care and neither guarantees nor promises that the Permit will be granted by the competent authority. The decision on the application lies exclusively within the competence of the relevant state authority, and accordingly:",
        ru: "Исполнитель принимает на себя обязательство действовать с должной профессиональной осмотрительностью и не гарантирует и не обещает выдачу Разрешения компетентным органом. Принятие решения по заявлению относится исключительно к компетенции соответствующего государственного органа, в связи с чем:",
        items: [
          {
            key: "a",
            en: "the Provider shall bear no liability for the interpretation of the law, the assessment of circumstances, or the administrative practice of the authority;",
            ru: "Исполнитель не несет ответственности за толкование закона, оценку обстоятельств и административную практику органа власти;",
          },
          {
            key: "b",
            en: "the Provider's liability is limited to acting in good faith, with due professional care and in accordance with the terms of this Agreement.",
            ru: "ответственность Исполнителя ограничивается тем, что он действует добросовестно, с должной профессиональной осмотрительностью и в соответствии с условиями настоящего Договора.",
          },
        ],
      },
      {
        n: "4",
        en: "The Client acknowledges that the Provider acts not as a legal representative (attorney-at-law) but as a consultant, and that representation of the Client's interests before state authorities shall be carried out by the Provider only where the Parties separately agree to this in writing on different payment terms.",
        ru: "Клиент принимает к сведению, что Исполнитель действует не в качестве юридического представителя (адвоката), а в качестве консультанта, и представительство интересов Клиента перед государственными органами осуществляется Исполнителем только в том случае, если Стороны отдельно и письменно договорятся об этом на иных условиях оплаты.",
      },
      {
        n: "5",
        en: "The services under this Agreement shall be deemed rendered in full from the moment the Provider has performed all actions set out in Specification No. 1 (Annex No. 1), irrespective of the outcome of the review of the application by the competent authority.",
        ru: "Услуги по настоящему Договору считаются оказанными в полном объёме с момента выполнения Исполнителем всех действий, предусмотренных Спецификацией №1 (Приложение №1), независимо от результата рассмотрения заявления компетентным органом.",
      },
    ],
  },
  {
    roman: "II",
    title: { en: "REMUNERATION AND PAYMENT TERMS", ru: "ВОЗНАГРАЖДЕНИЕ И УСЛОВИЯ ОПЛАТЫ" },
    clauses: [
      {
        n: "1",
        en: "The total price of the services under this Agreement is determined in accordance with Specification No. 1 of services (Annex No. 1), which forms an integral part of this Agreement. Payment to the Provider shall be made in the manner and on the terms set out in this Agreement.",
        ru: "Общая стоимость услуг по настоящему Договору определяется в соответствии со Спецификацией №1 услуг (Приложение №1), которая является неотъемлемой частью настоящего Договора. Оплата Исполнителю осуществляется в порядке и на условиях, предусмотренных настоящим Договором.",
      },
      {
        n: "2",
        en: "The Remuneration shall be paid as follows:",
        ru: "Вознаграждение уплачивается следующим образом:",
        items: [
          {
            key: "a",
            en: "the first payment shall be made as an advance payment by bank transfer to the Provider's account specified above within 3 (three) days from the date of signing this Agreement;",
            ru: "первый платеж уплачивается в качестве предоплаты путем банковского перевода на вышеуказанный счет Исполнителя в течение 3 (трех) дней с даты подписания настоящего Договора;",
          },
          {
            key: "b",
            en: "the second payment shall be made by bank transfer within 5 (five) days from the date on which the Client receives notice that the competent authority has approved the granting of the Permit.",
            ru: "второй платеж подлежит уплате путем банковского перевода в течение 5 (пяти) дней с даты получения Клиентом уведомления о том, что компетентный орган одобрил выдачу Разрешения.",
          },
        ],
      },
      {
        n: "3",
        en: "The Parties have agreed that:",
        ru: "Стороны согласовали, что:",
        items: [
          {
            key: "a",
            en: "if the Permit application is rejected by the competent authority for reasons attributable to the Client (in particular, submission of inaccurate data or incomplete documents, or failure to meet deadlines through the Client's fault), the advance payment shall be non-refundable, and the Provider shall, taking into account the work already performed, be entitled to claim the remaining part of the Remuneration to the extent the services have already been rendered;",
            ru: "в случае если заявление о выдаче Разрешения будет отклонено компетентным органом по причинам, зависящим от Клиента (в частности, предоставление недостоверных данных, неполных документов, пропуск сроков по вине Клиента), предоплата возврату не подлежит, и Исполнитель, с учетом уже выполненных работ, вправе требовать оставшуюся часть Вознаграждения в той мере, в какой услуги уже оказаны;",
          },
          {
            key: "b",
            en: "if the Permit application is rejected for reasons not attributable to the Client (for example, a change of legislation, discontinuation of the programme, or other circumstances beyond the Client's control), the Provider shall refund to the Client that portion of the advance payment which corresponds to the services not yet rendered. The amount subject to refund shall be determined by the Provider on the basis of the proportion of services actually performed, with a written calculation provided to the Client;",
            ru: "в случае если заявление о выдаче Разрешения будет отклонено по причинам, не зависящим от Клиента (например, изменение законодательства, прекращение программы, иные независящие от Клиента обстоятельства), Исполнитель возвращает Клиенту ту часть предоплаты, которая приходится на еще не оказанные услуги. Размер подлежащей возврату суммы определяется Исполнителем на основании доли фактически выполненных услуг, с предоставлением Клиенту письменного расчета;",
          },
          {
            key: "c",
            en: "if the Permit is not granted as a result of a material breach of the Agreement by the Provider (for example, unjustified delay in preparing the documents), the Client shall be entitled to terminate the Agreement by way of extraordinary (immediate) termination and to claim a partial or full refund of the Remuneration paid, in proportion to the work actually and duly performed.",
            ru: "в случае если Разрешение не будет выдано вследствие существенного нарушения Договора со стороны Исполнителя (например, необоснованная задержка подготовки документов), Клиент вправе расторгнуть Договор в порядке чрезвычайного (досрочного) расторжения и требовать частичного или полного возврата уплаченного Вознаграждения пропорционально фактически и надлежащим образом выполненным работам.",
          },
        ],
      },
      {
        n: "4",
        en: "In the event of a delay in payment by the Client, the Provider shall be entitled to default interest at the rate provided by the applicable law for the entire period of delay and, if the payment delay exceeds 15 (fifteen) days from the payment due date, the Provider shall be entitled to suspend the provision of services until the debt is settled in full.",
        ru: "В случае просрочки оплаты со стороны Клиента Исполнитель имеет право на получение процентов за просрочку в размере, предусмотренном применимым правом, за весь период просрочки, а также, если просрочка оплаты превышает 15 (пятнадцать) дней с момента наступления срока платежа, Исполнитель вправе приостановить оказание услуг до полного погашения задолженности.",
      },
    ],
  },
  {
    roman: "III",
    title: { en: "OBLIGATIONS OF THE CLIENT", ru: "ОБЯЗАННОСТИ КЛИЕНТА" },
    clauses: [
      {
        n: "1",
        en: "The Client shall cooperate with the Provider in the performance of this Agreement, act in accordance with its terms and avoid any unjustified delays.",
        ru: "Клиент обязан сотрудничать с Исполнителем при исполнении настоящего Договора, действовать в соответствии с его условиями и не допускать необоснованных задержек.",
      },
      {
        n: "2",
        en: "The Client shall provide the Provider with truthful, accurate and complete information, as well as all necessary documents.",
        ru: "Клиент обязан предоставлять Исполнителю достоверную, точную и полную информацию, а также все необходимые документы.",
      },
      {
        n: "3",
        en: "The Client shall immediately inform the Provider of all material circumstances that may affect the performance of the Agreement (in particular, any change in marital status, place of residence, employer or income level, as well as the existence or commencement of any administrative or other proceedings concerning the Client).",
        ru: "Клиент обязан незамедлительно информировать Исполнителя обо всех существенных обстоятельствах, которые могут повлиять на исполнение Договора (в частности, об изменении семейного положения, адреса проживания, работодателя, уровня доходов, а также о наличии или начале административных или иных процедур в отношении Клиента).",
      },
      {
        n: "4",
        en: "The Client shall submit the required documents within the deadlines set by the Provider and shall assist in obtaining them. In the event of the Client's delay or failure to perform these obligations, the Provider shall bear no liability for missed deadlines or the consequences arising therefrom.",
        ru: "Клиент обязан в установленные Исполнителем сроки передавать необходимые документы и содействовать в их получении. В случае задержки или неисполнения Клиентом указанных обязанностей Исполнитель не несет ответственности за пропуск сроков и вытекающие из этого последствия.",
      },
      {
        n: "5",
        en: "The Client shall maintain confidentiality with respect to all confidential information and trade secrets concerning the Provider that become known to the Client in the course of the performance of this Agreement. This confidentiality obligation shall remain in force for 5 (five) years after the termination of the Agreement.",
        ru: "Клиент обязан сохранять конфиденциальность в отношении всех конфиденциальных сведений и коммерческой тайны, касающихся Исполнителя, которые стали известны Клиенту в ходе исполнения настоящего Договора. Обязанность по сохранению конфиденциальности сохраняет силу в течение 5 (пяти) лет после прекращения действия Договора.",
      },
    ],
  },
  {
    roman: "IV",
    title: {
      en: "OBLIGATIONS AND LIABILITY OF THE PROVIDER",
      ru: "ОБЯЗАННОСТИ И ОТВЕТСТВЕННОСТЬ ИСПОЛНИТЕЛЯ",
    },
    clauses: [
      {
        n: "1",
        en: "In performing this Agreement, the Provider shall act in good faith, with due professional care and in accordance with the applicable law.",
        ru: "Исполнитель обязан при исполнении настоящего Договора действовать добросовестно, с должной профессиональной осмотрительностью и в соответствии с применимым законодательством.",
      },
      {
        n: "2",
        en: "The Provider shall maintain confidentiality with respect to all information and documents that become known to it in the course of the performance of the Agreement and shall not disclose them where the Client does not wish them to be disclosed. The Provider may transfer such information to third parties only:",
        ru: "Исполнитель обязан сохранять конфиденциальность в отношении всей информации и документов, ставших ему известными в ходе исполнения Договора, и не разглашать их, если Клиент не желает их раскрытия. Исполнитель вправе передавать такую информацию третьим лицам только:",
        items: [
          {
            key: "a",
            en: "with the Client's prior written consent; or",
            ru: "при наличии предварительного письменного согласия Клиента, либо",
          },
          {
            key: "b",
            en: "for the purposes of complying with statutory requirements or upon an official request of the competent authorities.",
            ru: "в целях исполнения требований закона или по официальному запросу компетентных органов.",
          },
        ],
      },
      {
        n: "3",
        en: "The Provider's liability under this Agreement, save in cases of intent or gross negligence, shall be limited to the amount of the Remuneration actually paid by the Client to the Provider.",
        ru: "Ответственность Исполнителя по настоящему Договору, за исключением случаев умысла или грубой неосторожности, ограничивается суммой Вознаграждения, фактически уплаченного Клиентом Исполнителю.",
      },
      {
        n: "4",
        en: "The Provider shall bear no liability for a refusal to grant the Permit, a delay in the review of the application, or a change in the administrative practice of the competent authority, provided that the Provider has duly discharged its due-care obligations under this Agreement.",
        ru: "Исполнитель не несет ответственности за отказ в выдаче Разрешения, задержку рассмотрения заявления или изменение административной практики компетентного органа, при условии, что Исполнитель надлежащим образом исполнил свои обязательства по проявлению должной осмотрительности в соответствии с настоящим Договором.",
      },
    ],
  },
  {
    roman: "V",
    title: {
      en: "IMPROPER PERFORMANCE, BREACH OF THE AGREEMENT AND CONSEQUENCES",
      ru: "НЕНАДЛЕЖАЩЕЕ ИСПОЛНЕНИЕ, НАРУШЕНИЕ ДОГОВОРА И ПОСЛЕДСТВИЯ",
    },
    clauses: [
      {
        n: "1",
        en: "The Provider shall be deemed to have performed its obligations improperly if the services provided for in this Agreement:",
        ru: "Исполнитель считается исполнившим обязательства ненадлежащим образом, если предусмотренные настоящим Договором услуги:",
        items: [
          { key: "a", en: "are not rendered;", ru: "не оказываются;" },
          { key: "b", en: "are rendered with delay; or", ru: "оказываются с задержкой; или" },
          {
            key: "c",
            en: "are rendered without observing the agreed standard of professional care.",
            ru: "оказываются без соблюдения оговоренного уровня профессиональной осмотрительности.",
          },
        ],
      },
      {
        n: "2",
        en: "In the event of improper performance, the Client shall be entitled:",
        ru: "В случае ненадлежащего исполнения Клиент вправе:",
        items: [
          {
            key: "a",
            en: "to demand the remedy of the defects or the repeated rendering of the services within a reasonable period;",
            ru: "потребовать устранения недостатков или повторного оказания услуг в разумный срок;",
          },
          {
            key: "b",
            en: "where the defects attributable to the Provider cannot be remedied, or attempts to remedy them repeatedly prove unsuccessful, to demand a proportionate reduction of the Remuneration;",
            ru: "если недостатки по вине Исполнителя не могут быть устранены или их устранение неоднократно оказывается безрезультатным, потребовать соразмерного уменьшения Вознаграждения;",
          },
          {
            key: "c",
            en: "in the event of a material breach of the Agreement — to terminate the Agreement by way of extraordinary (immediate) termination and to claim compensation for damages.",
            ru: "в случае существенного нарушения Договора – расторгнуть Договор в порядке чрезвычайного (досрочного) расторжения и требовать возмещения убытков.",
          },
        ],
      },
      {
        n: "3",
        en: "In the event of a delay by the Provider in performing its obligations, the Client shall be entitled to set an additional reasonable period for performance. If the obligations are not performed within that period either, the Client shall be entitled to terminate the Agreement by way of extraordinary (immediate) termination.",
        ru: "В случае просрочки исполнения обязательств Исполнителем Клиент вправе установить дополнительный разумный срок для исполнения. Если и в этот срок обязательства не будут исполнены, Клиент вправе расторгнуть Договор в порядке чрезвычайного (досрочного) расторжения.",
      },
      {
        n: "4",
        en: "In the event of a breach of the Agreement by the Client, in particular a delay in payment or a failure to fulfil cooperation obligations, the Provider shall be entitled:",
        ru: "В случае нарушения Договора Клиентом, в частности при просрочке оплаты или невыполнении обязанностей по сотрудничеству, Исполнитель вправе:",
        items: [
          {
            key: "a",
            en: "to suspend the performance of its obligations;",
            ru: "приостановить исполнение своих обязательств;",
          },
          {
            key: "b",
            en: "after granting a reasonable additional period to remedy the breach — to terminate the Agreement by way of extraordinary (immediate) termination;",
            ru: "после предоставления разумного дополнительного срока для устранения нарушения – расторгнуть Договор в порядке чрезвычайного (досрочного) расторжения;",
          },
          {
            key: "c",
            en: "to claim from the Client compensation for the damages caused and the reasonable costs incurred.",
            ru: "требовать от Клиента возмещения причиненных убытков и понесенных разумных расходов.",
          },
        ],
      },
    ],
  },
  {
    roman: "VI",
    title: { en: "PROCESSING OF PERSONAL DATA", ru: "ОБРАБОТКА ПЕРСОНАЛЬНЫХ ДАННЫХ" },
    clauses: [
      {
        n: "1",
        en: "In the course of performing this Agreement, the Provider processes the personal data of the Client and, where necessary, of the Client's relatives and representatives. The purpose of the processing is the provision of the services set out in this Agreement, in particular the preparation of the documents required to obtain the Permit and assistance with the related procedures.",
        ru: "Исполнитель в рамках исполнения настоящего Договора обрабатывает персональные данные Клиента, а при необходимости – его родственников и представителей. Цель обработки данных – оказание услуг, предусмотренных настоящим Договором, в частности подготовка документов, необходимых для получения Разрешения, и содействие в связанных с этим процедурах.",
      },
      {
        n: "2",
        en: "The legal basis for the processing of personal data is, in particular:",
        ru: "Правовым основанием обработки персональных данных является, в частности:",
        items: [
          {
            key: "a",
            en: "the performance of the contract between the Parties;",
            ru: "исполнение договора между Сторонами;",
          },
          {
            key: "b",
            en: "compliance with the statutory obligations imposed on the Provider.",
            ru: "выполнение возложенных на Исполнителя законодательных обязанностей.",
          },
        ],
      },
      {
        n: "3",
        en: "The Provider processes personal data to the extent and for the period necessary for the performance of the Agreement and retains such data for no longer than 5 (five) years after the completion of the procedures related to the Permit, unless otherwise required by law.",
        ru: "Исполнитель обрабатывает персональные данные в объеме и в течение срока, необходимых для исполнения Договора, и хранит их не более 5 (пяти) лет после завершения процедур, связанных с Разрешением, если иное не требуется законом.",
      },
      {
        n: "4",
        en: "The recipients of personal data may include:",
        ru: "Получателями персональных данных могут являться:",
        items: [
          {
            key: "a",
            en: "the competent authorities reviewing the Permit application;",
            ru: "компетентные органы, рассматривающие заявление о выдаче Разрешения;",
          },
          {
            key: "b",
            en: "the Provider's representatives and subcontractors (for example, translators, administrative assistants), where access to the data is necessary for the performance of their duties.",
            ru: "представители и субподрядчики Исполнителя (например, переводчики, административные помощники), если доступ к данным необходим для выполнения их обязанностей.",
          },
        ],
      },
      {
        n: "5",
        en: "The Client holds the rights of a data subject under the General Data Protection Regulation (GDPR), in particular:",
        ru: "Клиент обладает правами субъекта персональных данных в соответствии с Общим регламентом по защите данных (GDPR), в частности:",
        items: [
          {
            key: "a",
            en: "the right of access to his or her personal data;",
            ru: "правом на доступ к своим персональным данным;",
          },
          { key: "b", en: "the right to rectification thereof;", ru: "правом на их исправление;" },
          {
            key: "c",
            en: "the right to erasure and to restriction of processing;",
            ru: "правом на удаление и ограничение обработки;",
          },
          {
            key: "d",
            en: "the right to object to the processing;",
            ru: "правом на возражение против обработки;",
          },
          {
            key: "e",
            en: "the right to lodge a complaint with the competent supervisory authority.",
            ru: "правом на подачу жалобы в компетентный надзорный орган.",
          },
        ],
      },
    ],
  },
  {
    roman: "VII",
    title: { en: "FORCE MAJEURE", ru: "ФОРС-МАЖОР (ОБСТОЯТЕЛЬСТВА НЕПРЕОДОЛИМОЙ СИЛЫ)" },
    clauses: [
      {
        n: "1",
        en: "Force majeure comprises any extraordinary, unforeseeable and unavoidable circumstances beyond the control of the Parties (in particular: war, natural disasters, epidemics, closure of borders, changes in legislation or administrative practice to such an extent that performance of the Agreement becomes impossible) which prevent or materially impede the performance of this Agreement.",
        ru: "К обстоятельствам форс-мажора относятся любые чрезвычайные, непредвиденные и неизбежные обстоятельства, находящиеся вне контроля Сторон (в частности: война, стихийные бедствия, эпидемии, закрытие границ, изменения законодательства или административной практики в такой степени, что исполнение Договора становится невозможным), которые препятствуют или существенно затрудняют исполнение настоящего Договора.",
      },
      {
        n: "2",
        en: "Upon the occurrence of force majeure circumstances, the affected Party shall, without undue delay, notify the other Party in writing and take all reasonable measures to minimise possible losses.",
        ru: "В случае наступления форс-мажорных обстоятельств затронутая ими Сторона обязана без необоснованной задержки письменно уведомить другую Сторону и принять все разумные меры для минимизации возможных убытков.",
      },
      {
        n: "3",
        en: "For the duration of the force majeure circumstances, the affected Party shall be released from the performance of its obligations to the extent that performance has become impossible as a result of the force majeure.",
        ru: "На период действия форс-мажорных обстоятельств затронутая ими Сторона освобождается от исполнения своих обязательств в той мере, в какой исполнение стало невозможным вследствие форс-мажора.",
      },
      {
        n: "4",
        en: "If the force majeure circumstances continue for more than 60 (sixty) days, either Party shall be entitled to terminate this Agreement unilaterally by written notice, with a proportionate settlement for the services already rendered.",
        ru: "Если форс-мажорные обстоятельства длятся более 60 (шестидесяти) дней, каждая из Сторон вправе расторгнуть настоящий Договор в одностороннем порядке путем письменного уведомления, с произведением пропорционального расчета за уже оказанные услуги.",
      },
    ],
  },
  {
    roman: "VIII",
    title: {
      en: "AMENDMENT AND TERMINATION OF THE AGREEMENT",
      ru: "ИЗМЕНЕНИЕ И ПРЕКРАЩЕНИЕ ДОГОВОРА",
    },
    clauses: [
      {
        n: "1",
        en: "The Parties have agreed that any amendments and supplements to this Agreement shall be valid only if made in writing and signed by both Parties.",
        ru: "Стороны договорились, что любые изменения и дополнения к настоящему Договору действительны только в случае их совершения в письменной форме и подписания обеими Сторонами.",
      },
      {
        n: "2",
        en: "The Agreement shall terminate:",
        ru: "Договор прекращается:",
        items: [
          {
            key: "a",
            en: "by mutual written agreement of the Parties;",
            ru: "по взаимному письменному соглашению Сторон;",
          },
          { key: "b", en: "by ordinary termination;", ru: "путем обычного (ординарного) расторжения;" },
          {
            key: "c",
            en: "by extraordinary (immediate) termination;",
            ru: "путем чрезвычайного (досрочного) расторжения;",
          },
          {
            key: "d",
            en: "upon the performance by the Parties of all their obligations, where the term of the Agreement is linked to the full rendering of the services.",
            ru: "по исполнении Сторонами всех своих обязательств, если срок действия Договора связан с полным исполнением услуг.",
          },
        ],
      },
      {
        n: "3",
        en: "Either Party shall be entitled to terminate this Agreement by way of ordinary termination without stating reasons, by serving written notice with a 30 (thirty) day notice period. Before the expiry of that period, the Parties shall carry out mutual settlements.",
        ru: "Каждая из Сторон вправе расторгнуть настоящий Договор в порядке обычного (ординарного) расторжения без указания причин, направив письменное уведомление с 30 (тридцатидневным) сроком предварительного уведомления. До истечения этого срока Стороны обязаны произвести взаимные расчеты.",
      },
      {
        n: "4",
        en: "Either Party shall be entitled to terminate the Agreement by way of extraordinary (immediate) termination with immediate effect if the other Party materially breaches its obligations under the Agreement and fails to remedy the breach within a reasonable period (but not less than 8 days) after receipt of a written notice.",
        ru: "Каждая из Сторон вправе расторгнуть Договор в порядке чрезвычайного (досрочного) расторжения с немедленным вступлением в силу, если другая Сторона существенно нарушает свои обязательства по Договору и не устраняет нарушения в разумный срок (но не менее 8 дней) после получения письменного уведомления.",
      },
      {
        n: "5",
        en: "Upon termination of the Agreement, the Parties shall carry out a mutual settlement, in particular with respect to the services already rendered, the Remuneration paid and the amounts subject to refund.",
        ru: "В случае прекращения Договора Стороны производят взаимный расчет, в частности в отношении уже оказанных услуг, уплаченного Вознаграждения и сумм, подлежащих возврату.",
      },
    ],
  },
  {
    roman: "IX",
    title: {
      en: "GOVERNING LAW AND DISPUTE RESOLUTION",
      ru: "ПРИМЕНИМОЕ ПРАВО И РАЗРЕШЕНИЕ СПОРОВ",
    },
    clauses: [
      {
        n: "1",
        en: "The Parties undertake to resolve, wherever possible, all disputes arising out of or in connection with this Agreement by negotiation and amicable settlement.",
        ru: "Стороны обязуются, по возможности, разрешать все споры, возникающие из настоящего Договора или в связи с ним, путем переговоров и мирного урегулирования.",
      },
      {
        n: "2",
        en: "If the Parties fail to settle a dispute by negotiation within 30 days, the dispute shall be referred to the competent court at the Provider's registered seat, subject to the applicable rules of jurisdiction.",
        ru: "В случае если Стороны не смогут урегулировать спор путем переговоров в течение 30 дней, спор подлежит рассмотрению компетентным судом по месту нахождения (регистрации) Исполнителя, с учетом применимых правил подсудности.",
      },
    ],
  },
  {
    roman: "X",
    title: { en: "CONFIDENTIALITY (GENERAL PROVISION)", ru: "КОНФИДЕНЦИАЛЬНОСТЬ (ОБОБЩАЮЩЕЕ ПОЛОЖЕНИЕ)" },
    clauses: [
      {
        n: "1",
        en: "All information, documents, commercial and personal data transferred or made available to the Parties in connection with this Agreement shall be deemed confidential.",
        ru: "Вся информация, документы, коммерческие и персональные данные, переданные или ставшие доступными Сторонам в связи с настоящим Договором, считаются конфиденциальными.",
      },
      {
        n: "2",
        en: "The Parties may use confidential information exclusively for the purposes of performing this Agreement and may transfer it to third parties only with the written consent of the other Party or in order to comply with statutory requirements.",
        ru: "Стороны вправе использовать конфиденциальную информацию исключительно для целей исполнения настоящего Договора и вправе передавать ее третьим лицам только при наличии письменно выраженного согласия другой Стороны либо для выполнения требований закона.",
      },
      {
        n: "3",
        en: "The confidentiality obligation shall remain in force for 5 (five) years after the termination of this Agreement.",
        ru: "Обязанность по сохранению конфиденциальности сохраняет силу в течение 5 (пяти) лет после прекращения действия настоящего Договора.",
      },
    ],
  },
  {
    roman: "XI",
    title: { en: "FINAL PROVISIONS", ru: "ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ" },
    clauses: [
      {
        n: "1",
        en: "The Parties confirm that they have the legal capacity required to enter into this Agreement, that they have carefully read its contents, fully understand its terms and sign it as a document that fully reflects their true will.",
        ru: "Стороны подтверждают, что обладают необходимой право- и дееспособностью для заключения настоящего Договора, что они внимательно ознакомились с его содержанием, полностью понимают его условия и подписывают его как документ, полностью отражающий их действительную волю.",
      },
      {
        n: "2",
        en: "This Agreement is executed in 2 (two) original counterparts, one for each Party. All counterparts have equal legal force and identical content.",
        ru: "Настоящий Договор составлен в 2 (двух) оригинальных экземплярах, по одному для каждой из Сторон. Все экземпляры имеют одинаковую юридическую силу и идентичное содержание.",
      },
    ],
  },
];

export function pickLocaleText(
  value: { en: string; ru: string },
  locale: AppLocale,
): string {
  return locale === "ru" ? value.ru : value.en;
}
