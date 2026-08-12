import type { AppLocale } from "@/i18n/config";

export type PolicyInline =
  | string
  | { bold: string }
  | { link: string; href: string };

export type PolicyBlock =
  | {
      type: "company";
      name: string;
      addressLabel: string;
      addressLines: string[];
      emailLabel: string;
      email: string;
    }
  | { type: "title"; text: string }
  | { type: "subtitle"; text: string }
  | { type: "meta"; text: string }
  | { type: "paragraph"; parts: PolicyInline[] }
  | { type: "heading"; text: string }
  | { type: "list"; items: PolicyInline[][] }
  | { type: "acknowledgement"; parts: PolicyInline[] }
  | { type: "closing"; text: string };

const COMPANY = "SPIORA Technologies Limited Liability Company";
const EMAIL = "info@spiora.ai";
const ADDRESS_RU = [
  "Кыргызстан, 720044, г. Бишкек, Октябрьский район, ул. Политехническая, д. 9",
];
const ADDRESS_EN = [
  "9, Politekhnicheskaya Street,",
  "Oktyabrsky District, Bishkek, 720044,",
  "Kyrgyzstan",
];

const POLICY_RU: PolicyBlock[] = [
  {
    type: "company",
    name: COMPANY,
    addressLabel: "Юридический адрес",
    addressLines: ADDRESS_RU,
    emailLabel: "E-mail",
    email: EMAIL,
  },
  { type: "title", text: "ПОЛИТИКА ОБРАБОТКИ ПЕРСОНАЛЬНЫХ ДАННЫХ" },
  {
    type: "subtitle",
    text: "клиентов SPIORA Technologies Limited Liability Company",
  },
  { type: "meta", text: "Версия 1.0 · Редакция от 07.08.2026" },
  {
    type: "paragraph",
    parts: [
      "Настоящая Политика описывает, какие персональные данные Оператор собирает у клиентов, для каких целей эти данные используются, как они защищаются и какие права есть у клиента в отношении своих данных. Политика составлена в соответствии с Регламентом (ЕС) 2016/679 (GDPR) и применимым законодательством о защите персональных данных.",
    ],
  },
  { type: "heading", text: "1. Оператор персональных данных" },
  {
    type: "paragraph",
    parts: ["Оператором персональных данных является:"],
  },
  {
    type: "list",
    items: [
      [
        { bold: "SPIORA Technologies Limited Liability Company" },
        ", юридический адрес: Кыргызстан, 720044, г. Бишкек, Октябрьский район, ул. Политехническая, д. 9 (далее — «Оператор»).",
      ],
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Настоящая Политика применяется к клиентам, потенциальным клиентам и иным физическим лицам, чьи персональные данные обрабатываются Оператором в связи с рассмотрением обращения, заключением или исполнением договора.",
    ],
  },
  { type: "heading", text: "2. Какие данные мы собираем" },
  {
    type: "paragraph",
    parts: [
      "Оператор собирает и хранит следующие категории персональных данных клиента и, при необходимости, членов его семьи:",
    ],
  },
  {
    type: "list",
    items: [
      [
        "документы, удостоверяющие личность, и иные официальные документы, подтверждающие правовой статус;",
      ],
      [
        "банковские выписки и иные документы, подтверждающие доходы и финансовое состояние;",
      ],
      ["дипломы, сертификаты об образовании и квалификации;"],
      ["документы о трудовой деятельности и источниках дохода;"],
      [
        "свидетельства о браке, о рождении детей и иные документы, подтверждающие семейное положение;",
      ],
      [
        "контактные данные (имя, фамилия, телефон, адрес электронной почты, адрес проживания);",
      ],
      [
        "номера и реквизиты официальных документов, даты их выдачи и окончания срока действия;",
      ],
      ["фотографии клиента и членов его семьи;"],
      [
        "данные членов семьи клиента, если они также являются участниками оказываемой услуги.",
      ],
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Оператор обрабатывает персональные данные, включая документы, содержащие сведения повышенной конфиденциальности, и, в случаях, предусмотренных законодательством, — специальные категории персональных данных. Такие данные обрабатываются с соблюдением требований GDPR и применимого законодательства.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Если Клиент передаёт Оператору документы третьих лиц (в том числе членов своей семьи), он подтверждает наличие законных оснований для такой передачи. Если персональные данные несовершеннолетнего предоставляются Оператору, Клиент подтверждает, что является его законным представителем либо обладает законными основаниями для передачи таких данных.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Оператор не требует предоставления персональных данных в объёме, превышающем необходимый для заключения и исполнения договора либо выполнения требований законодательства.",
    ],
  },
  { type: "heading", text: "3. Цели обработки данных" },
  {
    type: "paragraph",
    parts: [
      "Персональные данные обрабатываются добросовестно, законно и прозрачно, только в объёме, необходимом для достижения заявленных целей, и не дольше, чем это требуется для таких целей либо законодательством.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Персональные данные обрабатываются в целях заключения, исполнения и сопровождения договора с Клиентом, исполнения требований законодательства, защиты законных интересов Оператора, взаимодействия с Клиентом, а также для иных целей, непосредственно связанных с исполнением договора и не противоречащих применимому законодательству. Оператор не использует данные для целей, несовместимых с указанными в настоящей Политике, не продаёт персональные данные и не передаёт их третьим лицам в маркетинговых целях.",
    ],
  },
  { type: "heading", text: "4. Правовое основание обработки" },
  {
    type: "paragraph",
    parts: [
      "Предоставляя Оператору персональные данные и документы посредством формы на сайте либо иным способом, Клиент подтверждает, что ознакомился с настоящей Политикой обработки персональных данных.",
    ],
  },
  {
    type: "paragraph",
    parts: ["Правовыми основаниями обработки являются:"],
  },
  {
    type: "list",
    items: [
      [
        "исполнение договора об оказании услуг, стороной которого является Клиент (ст. 6(1)(b) GDPR) — основное основание для большинства операций;",
      ],
      [
        "согласие Клиента, предоставленное при передаче данных Оператору и принятии настоящей Политики — в отношении специальных категорий данных, где такое согласие требуется законом (ст. 6(1)(a), ст. 9(2)(a) GDPR);",
      ],
      [
        "выполнение юридической обязанности Оператора (ст. 6(1)(c) GDPR), если применимо.",
      ],
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Оператор не подменяет согласием обработку, объективно необходимую для исполнения договора или юридической обязанности.",
    ],
  },
  { type: "heading", text: "5. Кому передаются данные" },
  {
    type: "paragraph",
    parts: [
      "Персональные данные могут передаваться государственным органам, лицам, участвующим в исполнении договора, подрядчикам, консультантам, переводчикам, нотариусам, адвокатам, поставщикам IT-услуг и иным лицам исключительно в объёме, необходимом для исполнения договора либо выполнения требований законодательства.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Оператор не продаёт персональные данные клиентов и не передаёт их третьим лицам для целей, не связанных с исполнением договора.",
    ],
  },
  { type: "heading", text: "6. Международная передача данных" },
  {
    type: "paragraph",
    parts: [
      "В случае передачи персональных данных за пределы Европейской экономической зоны (в частности, при взаимодействии с органами и лицами, участвующими в исполнении договора, расположенными за её пределами, либо при использовании соответствующих IT-сервисов) Оператор обеспечивает такую передачу только при наличии предусмотренных GDPR правовых оснований (решение об адекватности Европейской комиссии, стандартные договорные положения (SCC) либо иные предусмотренные законодательством гарантии).",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Клиент вправе запросить у Оператора дополнительную информацию о конкретном основании передачи его данных.",
    ],
  },
  { type: "heading", text: "7. Использование IT-сервисов" },
  {
    type: "paragraph",
    parts: [
      "Оператор вправе использовать сторонние информационные системы, облачные сервисы и иные технические решения, необходимые для хранения, обработки, защиты и передачи персональных данных, при условии соблюдения требований законодательства о защите персональных данных.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Такие поставщики обрабатывают данные исключительно по поручению Оператора, в объёме, необходимом для оказания технической услуги, и связаны обязательствами по защите данных, соответствующими требованиям GDPR.",
    ],
  },
  { type: "heading", text: "8. Меры защиты данных" },
  {
    type: "paragraph",
    parts: [
      "Оператор принимает необходимые организационные и технические меры защиты персональных данных, соответствующие характеру обрабатываемых данных, уровню риска и требованиям применимого законодательства.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Несмотря на принимаемые меры безопасности, ни один способ передачи или хранения данных не может гарантировать абсолютную защиту информации.",
    ],
  },
  { type: "heading", text: "9. Срок хранения данных" },
  {
    type: "paragraph",
    parts: [
      "Персональные данные и документы хранятся Оператором в течение срока, необходимого для оказания услуг, а после их завершения — в течение срока, установленного применимым законодательством либо необходимого для защиты законных интересов Оператора.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "По истечении указанных сроков данные удаляются или обезличиваются, если их дальнейшее хранение не требуется законодательством.",
    ],
  },
  { type: "heading", text: "10. Права клиента" },
  {
    type: "paragraph",
    parts: [
      "В отношении своих персональных данных клиент имеет следующие права:",
    ],
  },
  {
    type: "list",
    items: [
      ["право на доступ к своим персональным данным;"],
      ["право на исправление неточных данных;"],
      [
        "право на удаление данных («право быть забытым») в случаях, предусмотренных законом;",
      ],
      ["право на ограничение обработки;"],
      ["право на переносимость данных;"],
      ["право возражать против обработки;"],
      [
        "право отозвать согласие в любое время без объяснения причин (в части, где обработка основана на согласии);",
      ],
      [
        "право подать жалобу в компетентный надзорный орган по защите персональных данных.",
      ],
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Каждое право применяется с учётом установленных законом условий и исключений.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Для реализации указанных прав клиент может обратиться к Оператору по контактным данным, указанным в разделе 12 настоящей Политики. При обоснованных сомнениях относительно личности заявителя Оператор вправе запросить минимальную дополнительную информацию, необходимую для подтверждения личности или полномочий представителя.",
    ],
  },
  { type: "heading", text: "11. Отзыв согласия" },
  {
    type: "paragraph",
    parts: [
      "В части, где обработка данных основана на согласии Клиента, Клиент вправе в любой момент отозвать такое согласие, направив соответствующее обращение Оператору.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Отзыв согласия не влияет на законность обработки, произведённой до момента отзыва, и не затрагивает обработку данных, необходимую для исполнения уже заключённого договора. Если на момент отзыва оказание услуги ещё не завершено, отзыв согласия может сделать дальнейшее оказание услуги невозможным, о чём Оператор уведомит Клиента отдельно.",
    ],
  },
  { type: "heading", text: "12. Контакты оператора" },
  {
    type: "paragraph",
    parts: [
      "По всем вопросам, связанным с обработкой персональных данных, клиент может обратиться к Оператору:",
    ],
  },
  {
    type: "list",
    items: [
      [
        { bold: "Оператор:" },
        " SPIORA Technologies Limited Liability Company;",
      ],
      [
        { bold: "юридический и почтовый адрес:" },
        " Кыргызстан, 720044, г. Бишкек, Октябрьский район, ул. Политехническая, д. 9;",
      ],
      [
        { bold: "электронная почта:" },
        " ",
        { link: EMAIL, href: `mailto:${EMAIL}` },
        ".",
      ],
    ],
  },
  { type: "heading", text: "13. Подтверждение ознакомления" },
  {
    type: "paragraph",
    parts: [
      "Форма подтверждения при предоставлении данных / оформлении заказа:",
    ],
  },
  {
    type: "acknowledgement",
    parts: [
      "Я подтверждаю, что ознакомился(ась) с настоящей Политикой обработки персональных данных, понимаю порядок обработки моих персональных данных, принимаю условия настоящей Политики и соглашаюсь на обработку предоставленных мной персональных данных в целях оказания заказанной услуги.",
    ],
  },
  { type: "closing", text: COMPANY },
];

const POLICY_EN: PolicyBlock[] = [
  {
    type: "company",
    name: COMPANY,
    addressLabel: "Registered Address",
    addressLines: ADDRESS_EN,
    emailLabel: "E-mail",
    email: EMAIL,
  },
  { type: "title", text: "PERSONAL DATA PROCESSING POLICY" },
  {
    type: "subtitle",
    text: "for Clients of SPIORA Technologies Limited Liability Company",
  },
  { type: "meta", text: "Version 1.0 · Revised on 07 August 2026" },
  {
    type: "paragraph",
    parts: [
      "This Personal Data Processing Policy (the “Policy”) describes what personal data the Controller collects from clients, the purposes for which such data is used, how it is protected, and what rights clients have in relation to their personal data.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "This Policy has been prepared in accordance with Regulation (EU) 2016/679 (General Data Protection Regulation — “GDPR”) and applicable personal data protection legislation.",
    ],
  },
  { type: "heading", text: "1. Data Controller" },
  {
    type: "paragraph",
    parts: ["The data controller is:"],
  },
  {
    type: "list",
    items: [
      [
        { bold: "SPIORA Technologies Limited Liability Company" },
        ", registered address: 9, Politekhnicheskaya Street, Oktyabrsky District, Bishkek, 720044, Kyrgyzstan (hereinafter referred to as the “Controller”).",
      ],
    ],
  },
  {
    type: "paragraph",
    parts: [
      "This Policy applies to clients, prospective clients, and other natural persons whose personal data is processed by the Controller in connection with reviewing an inquiry, entering into a contract, or performing a contract.",
    ],
  },
  { type: "heading", text: "2. Personal Data We Collect" },
  {
    type: "paragraph",
    parts: [
      "The Controller collects and stores the following categories of personal data relating to the Client and, where necessary, members of the Client’s family:",
    ],
  },
  {
    type: "list",
    items: [
      [
        "identity documents and other official documents confirming legal status;",
      ],
      [
        "bank statements and other documents confirming income and financial circumstances;",
      ],
      [
        "diplomas, educational certificates, and professional qualification certificates;",
      ],
      ["employment records and documents relating to sources of income;"],
      [
        "marriage certificates, children’s birth certificates, and other documents confirming family status;",
      ],
      [
        "contact details (first name, last name, telephone number, e-mail address, residential address);",
      ],
      [
        "numbers and details of official documents, including their issue and expiry dates;",
      ],
      ["photographs of the Client and members of the Client’s family;"],
      [
        "personal data of the Client’s family members where they are also participants in the services provided.",
      ],
    ],
  },
  {
    type: "paragraph",
    parts: [
      "The Controller processes personal data, including documents containing highly confidential information and, where provided for by applicable law, special categories of personal data. Such data is processed in compliance with the requirements of the GDPR and applicable legislation.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Where the Client provides the Controller with documents or personal data relating to third parties, including members of the Client’s family, the Client confirms that there is a lawful basis for providing such data. Where personal data relating to a minor is provided to the Controller, the Client confirms that they are the minor’s legal representative or otherwise have a lawful basis for providing such data.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "The Controller does not require personal data beyond what is necessary for entering into and performing a contract or complying with applicable legal requirements.",
    ],
  },
  { type: "heading", text: "3. Purposes of Personal Data Processing" },
  {
    type: "paragraph",
    parts: [
      "Personal data is processed fairly, lawfully, and transparently, only to the extent necessary to achieve the stated purposes and for no longer than required for those purposes or by applicable law.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Personal data is processed for the purposes of entering into, performing, and administering a contract with the Client; complying with legal requirements; protecting the Controller’s legitimate interests; communicating with the Client; and for other purposes directly related to the performance of the contract and not contrary to applicable law.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "The Controller does not use personal data for purposes incompatible with those specified in this Policy, does not sell personal data, and does not disclose personal data to third parties for marketing purposes.",
    ],
  },
  { type: "heading", text: "4. Legal Basis for Processing" },
  {
    type: "paragraph",
    parts: [
      "By providing personal data and documents to the Controller through a website form or by other means, the Client confirms that they have read this Personal Data Processing Policy.",
    ],
  },
  {
    type: "paragraph",
    parts: ["The legal bases for processing include:"],
  },
  {
    type: "list",
    items: [
      [
        "performance of a contract for the provision of services to which the Client is a party (Article 6(1)(b) GDPR) — the primary legal basis for most processing activities;",
      ],
      [
        "the Client’s consent, provided when submitting personal data to the Controller and accepting this Policy, in relation to special categories of personal data where such consent is required by law (Article 6(1)(a) and Article 9(2)(a) GDPR);",
      ],
      [
        "compliance with a legal obligation to which the Controller is subject (Article 6(1)(c) GDPR), where applicable.",
      ],
    ],
  },
  {
    type: "paragraph",
    parts: [
      "The Controller does not rely on consent as a substitute for another legal basis where processing is objectively necessary for the performance of a contract or compliance with a legal obligation.",
    ],
  },
  { type: "heading", text: "5. Recipients of Personal Data" },
  {
    type: "paragraph",
    parts: [
      "Personal data may be disclosed to public authorities, persons involved in the performance of the contract, contractors, consultants, translators, notaries, lawyers, IT service providers, and other persons solely to the extent necessary for the performance of the contract or compliance with applicable legal requirements.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "The Controller does not sell Clients’ personal data or disclose it to third parties for purposes unrelated to the performance of the contract.",
    ],
  },
  { type: "heading", text: "6. International Transfers of Personal Data" },
  {
    type: "paragraph",
    parts: [
      "Where personal data is transferred outside the European Economic Area (EEA), including in connection with public authorities or other persons involved in the performance of the contract located outside the EEA, or through the use of relevant IT services, the Controller ensures that such transfer takes place only where an appropriate legal basis or safeguard provided for under the GDPR is available, including an adequacy decision of the European Commission, Standard Contractual Clauses (SCCs), or other safeguards permitted by applicable law.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "The Client may request additional information from the Controller regarding the specific legal basis or safeguards applicable to the transfer of their personal data.",
    ],
  },
  { type: "heading", text: "7. Use of IT Services" },
  {
    type: "paragraph",
    parts: [
      "The Controller may use third-party information systems, cloud services, and other technical solutions necessary for the storage, processing, protection, and transmission of personal data, provided that applicable personal data protection requirements are observed.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Such service providers process personal data solely on behalf of the Controller and only to the extent necessary to provide the relevant technical services. They are subject to data protection obligations consistent with the requirements of the GDPR.",
    ],
  },
  { type: "heading", text: "8. Data Security Measures" },
  {
    type: "paragraph",
    parts: [
      "The Controller implements appropriate organisational and technical measures to protect personal data, taking into account the nature of the personal data processed, the level of risk, and the requirements of applicable legislation.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Despite the security measures implemented, no method of transmitting or storing information can guarantee absolute security.",
    ],
  },
  { type: "heading", text: "9. Data Retention Period" },
  {
    type: "paragraph",
    parts: [
      "Personal data and documents are retained by the Controller for the period necessary to provide the relevant services and, following completion of the services, for the period required by applicable law or necessary to protect the Controller’s legitimate interests.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Upon expiry of the applicable retention periods, personal data will be deleted or anonymised unless further retention is required by law.",
    ],
  },
  { type: "heading", text: "10. Client Rights" },
  {
    type: "paragraph",
    parts: [
      "With respect to their personal data, Clients have the following rights, subject to the conditions and limitations established by applicable law:",
    ],
  },
  {
    type: "list",
    items: [
      ["the right of access to their personal data;"],
      ["the right to rectification of inaccurate personal data;"],
      [
        "the right to erasure of personal data (the “right to be forgotten”) where provided by law;",
      ],
      ["the right to restriction of processing;"],
      ["the right to data portability;"],
      ["the right to object to processing;"],
      [
        "the right to withdraw consent at any time without providing reasons, where processing is based on consent;",
      ],
      [
        "the right to lodge a complaint with the competent personal data protection supervisory authority.",
      ],
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Each of these rights applies subject to the conditions and exceptions established by applicable law.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "To exercise any of these rights, the Client may contact the Controller using the contact details specified in Section 12 of this Policy. Where the Controller has reasonable doubts concerning the identity of the person making a request, the Controller may request the minimum additional information necessary to confirm the person’s identity or the authority of their representative.",
    ],
  },
  { type: "heading", text: "11. Withdrawal of Consent" },
  {
    type: "paragraph",
    parts: [
      "Where personal data processing is based on the Client’s consent, the Client may withdraw such consent at any time by submitting a corresponding request to the Controller.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "Withdrawal of consent does not affect the lawfulness of processing carried out before the consent was withdrawn and does not affect processing that is necessary for the performance of an existing contract.",
    ],
  },
  {
    type: "paragraph",
    parts: [
      "If the provision of services has not been completed at the time consent is withdrawn, withdrawal of consent may make it impossible for the Controller to continue providing the relevant service. In such a case, the Controller will inform the Client accordingly.",
    ],
  },
  { type: "heading", text: "12. Controller Contact Details" },
  {
    type: "paragraph",
    parts: [
      "For any questions relating to the processing of personal data, the Client may contact the Controller using the following details:",
    ],
  },
  {
    type: "list",
    items: [
      [
        { bold: "Controller:" },
        " SPIORA Technologies Limited Liability Company;",
      ],
      [
        { bold: "Registered and Mailing Address:" },
        " 9, Politekhnicheskaya Street, Oktyabrsky District, Bishkek, 720044, Kyrgyzstan;",
      ],
      [
        { bold: "E-mail:" },
        " ",
        { link: EMAIL, href: `mailto:${EMAIL}` },
        ".",
      ],
    ],
  },
  { type: "heading", text: "13. Acknowledgement" },
  {
    type: "paragraph",
    parts: [
      "The following acknowledgement may be used when submitting personal data or placing an order:",
    ],
  },
  {
    type: "acknowledgement",
    parts: [
      "I confirm that I have read this Personal Data Processing Policy, understand how my personal data will be processed, accept the terms of this Policy, and consent to the processing of the personal data provided by me for the purpose of delivering the requested service.",
    ],
  },
  { type: "closing", text: COMPANY },
];

export function getPersonalDataPolicy(locale: AppLocale): PolicyBlock[] {
  return locale === "ru" ? POLICY_RU : POLICY_EN;
}

export function personalDataPolicyPageTitle(locale: AppLocale): string {
  return locale === "ru"
    ? "Политика обработки персональных данных"
    : "Personal Data Processing Policy";
}

export const CLIENT_PRIVACY_POLICY_PATH = "/client/privacy";
