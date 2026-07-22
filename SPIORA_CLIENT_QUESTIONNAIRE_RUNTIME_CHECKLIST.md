# Spiora Client Questionnaire Engine — Runtime Checklist (PR #31)

- Client opens `/client` and sees questionnaire card
- Empty questionnaire open does not create draft row
- Invitation with explicit `questionnaire_template_key` binds to that published template
- First meaningful field edit creates one draft
- Autosave updates revision and survives refresh
- Clear operation removes stored answer and survives refresh
- Conditional field visibility shows/hides live
- Boolean `false` persists as a value, not as clear
- Required validation blocks review
- Validation summary appears and first invalid field receives focus
- Review shows localized option labels and hides display-only / hidden answers
- Review sets `in_review`
- Reopen returns to `draft`
- Client B cannot read or update client A questionnaire
- Employee routes remain separate from `/client` routes
