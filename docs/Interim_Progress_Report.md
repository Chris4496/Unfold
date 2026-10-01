# Interim Progress Report

*Unfold's problem definition, solution development, current outcomes and next steps*

## Progress Overview

Unfold currently focuses on letting Hong Kong secondary school and university students freely record everyday content, with Generative AI (GenAI) automatically organising and classifying it by timeline and conversation attributes. Students review records through a calendar and daily content summaries without seeing AI psychological analysis. During recording, AI may briefly acknowledge receipt, offer encouragement or occasionally invite elaboration on events and timing. Students can skip or end the interaction without continuing a conversation. Only when background AI judges that the support prompt threshold is approaching does it give a short explanation and ask whether to submit a case to a social worker. Students do not have to select records for analysis, organise content or read a complete professional analysis report. The team has documented the problem, target users, four-person division of work, and core recording and handoff flow. Questionnaire research, an operational prototype and actual effectiveness remain to be completed or confirmed.

The main outcomes so far concern problem definition and solution design. The next stage must turn design assumptions into research questions and the flow into an operational prototype, using traceable evaluation records to assess data processing, summary quality and student understanding. This report addresses the 23 specified questions. Additional work arrangements are proposed plans; dates and individual responsibilities still require team confirmation.

## Problem and Scope

### 1. What specific problem or pain point does your project address?

The project addresses the gap experienced by students who feel distressed but are not ready or able to seek human help. Some do not know where to start; others struggle to describe experiences built up over time from multiple events. Even if they know counselling services exist, they may need to organise what they want to say and decide what they are willing to disclose.

For example, a student may record academic, interpersonal and family events on different days, yet only say “I have been very stressed lately” when first seeking help. We want students to record anything freely, with GenAI automatically organising timelines, content attributes and related topics to generate a support summary and reduce preparation for a first conversation. This is a use scenario to validate, not a completed user observation.

### 2. What research have you conducted to better understand the problem?

Existing desk research draws on studies of Hong Kong youth and university students. HK-YES surveyed 3,340 Hong Kong residents aged 15–24 and found that 74.1% of those with a probable mental disorder had not received any services [1]. Another study of 945 university students found that only around a quarter of those with moderate to severe depressive symptoms had sought professional help [2].

These findings support further investigation of barriers to help seeking, but do not establish whether students would use a voice diary or whether summaries would improve their first help-seeking experience. The populations and measures differ, so the studies cannot directly estimate adoption of this product.

Student questionnaires have been selected as the main primary research method; results still need to be collected. Questions should be organised into four areas: help-seeking barriers, recording preferences, privacy understanding and willingness to share. Recruitment methods and sample composition should be documented, followed by an explanation of which findings support or revise the original design.

### 3. Why is this problem important, and whom does it affect?

The problem affects secondary school and university students who need support but have not accessed relevant services. Difficulty recalling or organising experiences may mean that students need more time to explain their situation to professionals. Social workers and counsellors also need to establish event context, duration and the student's priorities in a first conversation.

The project aims to provide a starting point for human support through timely prompts and case summaries submitted with student consent. Whether it reduces preparation effort, increases willingness to seek help or saves professionals time understanding context must be evaluated. The cited studies do not demonstrate this product's effectiveness.

### 4. What existing solutions are available, and what are their limitations?

Counsellors and social workers provide professional support, but students must still find services, initiate contact and explain their experiences. Helplines provide human contact, although service availability and a single call may limit follow-up. AI mental health chatbots are accessible but may misunderstand complex situations and cannot replace professional judgement. Ordinary diary or note tools preserve experiences, but users must still organise material for help seeking.

Unfold combines free private recording, automatic GenAI classification and organisation across records, calendar review, background support prompts and a human handoff. We need to establish whether these features address the target students' actual difficulties and understand their current recording and help-seeking practices. This combination has practical value only if students and professionals find the additional process useful.

## Proposed Solution

### 5. Describe the main goals of your project.

The main goal is to let students freely record everyday content for automatic GenAI classification and organisation, provide a calendar and daily content summaries to students, and analyse changes across days and support needs in the background. Students normally see a review of content without AI psychological ratings, risk scores or analysis reports. Brief acknowledgement, encouragement and optional invitations to add context can accompany recording while keeping interaction low intensity.

Only when AI judges that the records are approaching a threshold for intervention does the system offer support through a short explanation and ask whether to submit. After student consent, it automatically provides a professional case summary to a social worker; students need not check or revise the entire report first. The prototype should demonstrate the full flow of free recording, brief responses, calendar review, background analysis, support prompts, consent to submission and simulated social worker responses.

### 6. What are the boundaries of your project?

AI organises authorised records and analyses support cues to judge when to offer a prompt. The product does not diagnose, provide treatment, replace emergency services or make autonomous clinical decisions. Cases go to social workers only after student consent to submission. The everyday student interface does not show background psychological analysis. Routine responses are limited to acknowledgement, encouragement and optional elaboration, without repeated questioning or intensive psychological interviews. Students can complete an entry without responding.

The “threshold” is currently a design concept for support prompts. Its criteria, observation scope and prompt rules need to be designed and validated with appropriate professionals. The prototype will initially demonstrate operation using synthetic cases and simulated triggers; this does not establish that AI accurately identifies support needs. Live institutional integration, professional staffing, trials with real data and safeguarding for minors require separate arrangements.

### 7. What assumptions have you made about the problem and its context?

We assume some students will find speaking easier than filling in structured forms, value clear data controls, and may be more willing to contact professionals after an understandable support prompt. We also assume that automatic classification can spare students from organising fragmented content and give professionals useful context through summaries spanning time. These are research assumptions.

| Assumption | Proposed validation method | Possible adjustment if unsupported |
| --- | --- | --- |
| Voice reduces recording effort | Ask about preferences and observe recording and abandonment reasons in trials. | Add or prioritise text input. |
| Privacy controls build trust | Ask participants to explain storage and sharing. | Revise explanations, action order and confirmation steps. |
| Low intensity responses help recording | Observe whether acknowledgement and encouragement feel natural and invitations are skippable and unobtrusive. | Adjust response length, timing and frequency. |
| Calendar review is convenient | Observe whether students find a day's summary and understand it. | Adjust date navigation and daily summary format. |
| Support prompts help initiate help seeking | Use preset scenarios to assess prompt understanding, reactions and willingness to submit. | Adjust timing, explanations and options. |
| Summaries are useful to professionals | Have social workers or counsellors review synthetic summaries. | Add needed context and reduce information unhelpful for an initial conversation. |
| Private recording has value for continued use | Investigate review habits and reasons for stopping in later trials. | Revise private recording features and product positioning. |

### 8. Who is your target audience or user group?

The primary users are Hong Kong secondary school and university students, particularly those who want to record experiences first, are considering seeking help, or want to prepare for a first professional conversation. Social workers and counsellors participate in the other side of the process and should provide design feedback on summaries and handoffs.

The student groups may differ in private space, support pathways and expectations about sharing. They need separate analysis and different consent and safeguarding arrangements. Which group to recruit for the first evaluation, how to recruit and how to obtain appropriate consent remain undecided.

### 9. Who are your customers, meaning the groups that pay for the solution?

Expected customers are schools, universities and youth service organisations that provide or commission student support. No paying customers, partner organisations or pricing model have been confirmed.

Discussions with potential organisations need to establish whether they have professionals available to take cases, which workflows they want to improve, and how much additional reading and responding they can accommodate. Adoption must also consider maintenance, cloud usage and professional time costs. Student usefulness and institutional willingness to adopt require separate validation.

### 10. How do you collect information from your target audience, including testing?

Student questionnaires are the main primary research tool for understanding help-seeking barriers, recording preferences, privacy and willingness to share. Questionnaire and prototype evaluation results still need to be collected; user validation cannot yet be claimed.

A small questionnaire pilot is recommended to check that questions are understandable before collecting responses through agreed recruitment arrangements. Sensitive questions should be optional, detailed disclosure of private experiences should be avoided, and sample sources and potential biases should be documented. The team must supply sample targets, channels and dates.

Later usability evaluation can provide preset scenarios in which participants freely record mixed topics, experience brief AI responses and choose to elaborate or skip, view daily summaries in the calendar, and respond to simulated support prompts and submission options. Participants do not select analysis records, classify content manually or revise professional reports. Evaluation should observe both task outcomes and students' understanding of data flows. Professionals can review synthetic summaries to identify missing context, potentially misleading descriptions and necessary follow-up questions.

## Teamwork

### 11. How is your team organised, and what is each member responsible for?

The team has four members: two responsible for product design and data collection, and two developing the app. Current information does not name individuals or specify their assignments. The following proposed deliverables follow the responsibilities of the two groups.

| Working group | Proposed responsibilities | Reviewable outputs |
| --- | --- | --- |
| Product and research group, two members | Questionnaires, calendar and daily summary interface, brief responses and elaboration invitations, support prompts, professional summary fields, trials and professional feedback. | Questionnaire versions, flow sketches, feedback records and revised requirements. |
| Development group, two members | Local recording, speech-to-text, deidentification, GenAI classification, low intensity responses, daily summaries, background analysis and prompt triggers, professional case summaries and social worker interface. | Data flow, operational prototype, synthetic cases and technical evaluation records. |
| All members | Feature priorities, completion criteria and important design decisions. | Task list, decision records and demonstration outcomes. |

The groups have clear dependencies: summary fields and sharing rules must be defined before implementation, while technical constraints may affect interfaces and research questions. Each deliverable should therefore have a named owner and identify which group needs to provide input.

### 12. What communication methods do you use to ensure effective collaboration?

Product design and development currently align through shared user flows and prototype milestones. Existing documents have not established a meeting frequency, collaboration tools or work tracking method.

The next stage should introduce a shared task list with an owner, status, dependencies and completion criteria for each task. Meetings should focus on reviewing outputs and resolving blockers. For example, actual interfaces or evaluation cases can support discussion of whether calendar review and support prompts are understandable, instead of relying only on spoken percentage-complete reports.

Decisions affecting scope should have brief records explaining options, reasons and remaining validation needs. If questionnaire findings require changes to input or sharing, both groups should update requirements and development plans together. Meeting arrangements and tools remain for the team to confirm.

## Progress

### 13. What work has been completed so far?

According to existing documents, the team has focused the problem on the disclosure gap in help seeking, defined secondary school and university students as two user groups, arranged a four-person division of work, selected questionnaire research, and described free private recording, deidentification and automatic GenAI organisation. The current design further specifies low intensity recording responses, calendar review, background analysis, triggered prompts, student consent to submission and social worker handoff.

These outcomes are represented in the design content of the proposal and progress report. They do not yet establish that product features are complete or user needs have been validated.

| Work item | Currently confirmable status | Existing basis and evidence still needed |
| --- | --- | --- |
| Problem definition and literature | Documented | Problem description and research sources are listed; primary research results are needed. |
| Users and roles | Defined in documents | Student and social worker roles are described; interviews or questionnaires must confirm differences in needs. |
| Core flow and privacy direction | Proposed approach described | Calendar daily summaries are separated from background analysis, with student consent after a prompt; implementation and validation remain. |
| Automatic GenAI organisation | Design requirements clarified | Free input is classified by timeline and conversation attributes without student selection of analysis records; implementation and effectiveness remain to be validated. |
| Team responsibilities | Two-group direction established | Two members handle design and research and two handle development; individual tasks remain to be specified. |
| Questionnaire and data analysis | Method selected; outcomes to be confirmed | No complete questionnaire, recruitment record or analysis results have been provided. |
| Operational prototype | Completion or evidence pending | No usable version, demonstration record or completed feature list has been provided. |
| Student and professional evaluation | Pending | No evaluation records or revision outcomes have been provided. |

Future progress updates should include dates and links to actual outputs so that “complete” corresponds to a concrete deliverable. Missing evidence should be checked with the team rather than assuming completion.

### 14. Which part of the project are you currently working on?

The current work direction concerns questionnaires and a prototype covering free recording, low intensity AI responses, on-device deidentification, a calendar and daily summaries, background GenAI organisation and support prompts. The documents do not specify how far individual features have been developed.

The next stage must clearly distinguish student-visible and background data. Students see dates and neutral daily summaries; the background system holds classifications, trends across days and support cues; social workers receive professional case summaries after consent to submission. Dates are not marked with psychological labels or risk scores in the student interface.

Details still to design include speech-to-text capabilities, handling event times, timing of brief responses and invitations, threshold criteria, short explanation wording and the scope of consent to submission. The prototype should also show choosing not to submit, processing failures, waiting for social workers and rematching.

### 15. What are your next steps or milestones?

The next stage should proceed through research preparation, core flows and technical evaluation, followed by student and professional feedback. The following milestones are proposed; the team must supply dates and individual owners.

| Milestone | Main responsible group | Deliverables and completion criteria |
| --- | --- | --- |
| M1 Research preparation | Product and research group | Questionnaire, recruitment and analysis arrangements; every core assumption has corresponding questions. |
| M2 Flow confirmation | All members | Calendar, daily summaries, brief responses, background analysis and support prompt interfaces; explain consent, choosing not to submit and rematching. |
| M3 Core prototype | Development group | Synthetic cases proceed from free recording to calendar review, background analysis, simulated triggers and consent to submission; student interfaces exclude psychological assessments. |
| M4 Technical evaluation | Development group, with research group assisting checks | Document transcription, missed identifying details, timelines, conversation attribute classification, links across records and summary errors; separately assess false prompts, missed prompts and timing through a plan developed with professional participation. |
| M5 User and professional feedback | Product and research group | Consolidate trial and summary review findings and list priority revisions. |
| M6 Next-stage decision | All members | Revise scope based on evidence and assess partnership and real-world pilot conditions. |

Questionnaire collection and prototype development can partly run in parallel, but research arrangements and suitable data must be confirmed before trials. A live pilot needs additional institutional cooperation and professional support conditions.

### 16. How will you evaluate whether the project is progressing successfully?

Evaluation focuses on calendar and daily summary usability, data processing, background analysis and professional summary quality, while examining prompt understanding, trigger performance and willingness to submit. Each measure needs a clear collection method. Numerical targets and acceptance thresholds must be set before evaluation and have not yet been confirmed.

| Evaluation area | Proposed measurement method |
| --- | --- |
| Recording flow | Free recording task completion, time and reasons for stopping; check for additional selection or classification effort. |
| Privacy understanding | Ask students to explain which data stay on-device, which go to the cloud and what social workers can view. |
| Low intensity interaction | Check response brevity, ease of skipping invitations, repeated questioning and any feeling of being required to answer. |
| Calendar review | Observe whether students locate a date and understand its neutral summary; confirm psychological analysis is absent. |
| Prompts and submission | Check understanding of short explanations, recipients and submission scope, and ability to choose “Submit” or “Not now.” |
| Prompt trigger quality | Use cases and criteria developed with professionals to assess false prompts, missed prompts, timing and wording. |
| Deidentification | Check missed and excessively removed direct and indirect identifiers in synthetic cases. |
| Timelines and classification | Use mixed topics, references across entries and accounts of earlier events to check event order, multiple attributes and uncertainty labels. |
| Links across records | Check whether the same topic is reasonably linked without merging different events incorrectly. |
| Summary fidelity | Compare with original records for key omissions, timeline errors and unsupported additions. |
| Professional usefulness | Gather social worker or counsellor feedback on context completeness, reading burden and follow-up questions. |
| Willingness to use and share | Combine questionnaire responses and trial feedback to analyse reasons for willingness or reluctance. |

Satisfaction and self-reported willingness alone do not establish actual adoption. Time to human contact, continued use and service workload need longer observation. Short prototype trials cannot establish clinical effectiveness.

## Challenges

### 17. What challenges have you encountered, and how have you addressed them?

At the design stage, we have recognised that a single-button interface may not overcome limited trust or uncertainty about the product's value. Asking students to read and revise a complete psychological analysis report could also increase effort.

The current design uses calendar review, with students tapping dates to view daily content summaries. Classification and psychological trend analysis remain in the background. Only when AI judges that the support prompt threshold is approaching does it offer a short explanation and submission options. Students decide whether to accept that submission, while the system handles organisation.

These are design decisions, not evidence that students prefer this flow. Implementation failures, delays and user evaluation issues still require actual records. Expected effects cannot be treated as completed outcomes.

### 18. What challenges do you anticipate, and how will you address them?

Main risks include missed identifying details, distorted summaries, premature or missed support prompts, device and cloud processing, social worker capacity and safeguarding for minors. Deidentification and consent to submission need clear design and evaluation. Quality control cannot be shifted to students because they do not check complete reports.

| Anticipated challenge | Possible impact | Proposed response |
| --- | --- | --- |
| Speech-to-text errors | Classification and summaries rely on inaccurate text. | Evaluate target languages and device performance; offer optional transcript review and correction. |
| Missed or excessively removed identifiers | Identity is exposed or context loses meaning. | Automatic local processing, checks with synthetic cases and optional review of processing results. |
| Incorrect timelines or conversation attributes | Earlier events are treated as current-day events, or content of different kinds is misclassified. | Separate recording and event times, allow multiple attributes, and retain uncertainty and source comparisons. |
| Omitted or added summary content | Daily summaries or professional case information are distorted. | Compare with sources and conduct human checks during development evaluation, preserving uncertainty and supporting evidence for social workers. |
| Incorrect support prompts | False prompts cause distress or needed prompts are missed. | Develop thresholds and evaluation methods with appropriate professionals; check timing, frequency and wording. |
| Excessive responses or repeated questioning | Free expression is interrupted and students feel required to answer. | Keep acknowledgement and encouragement brief, make elaboration optional and adjust frequency using trial feedback. |
| AI responses treated as student accounts | Classification and summaries include things students did not say. | Distinguish student input from AI responses and base background analysis on actual student records. |
| Analysis appearing in the student interface | Everyday review becomes a psychological rating interface. | Distinguish daily content summaries, background analysis, short prompts and professional case information. |
| Unclear retention and withdrawal | Students misunderstand their control. | Define separate retention arrangements for local data, cloud data, shared summaries and messages. |
| No social worker or delayed responses | Students wait for long periods. | Confirm staffing, response arrangements and handling of unaccepted cases with organisations. |
| Consent and safeguarding for secondary school students | The flow may be unsuitable for minors. | Establish arrangements with partner organisations and appropriate professionals first. |

The design goal is to retain original audio and full transcripts on the device. Deidentified text is sent automatically according to confirmed cloud organisation settings, without students selecting records each time. Students normally view daily content summaries through the calendar and may receive brief recording responses. After background analysis triggers a short prompt, professional case information goes to social workers only if the student consents. Processing, notification and withdrawal for new records after submission remain undefined; the design does not presume that students must read and approve every full summary. The purposes of data processing authorisation and consent to this submission must be explained separately. Cloud retention, message handling and withdrawal limits for information already read also require clear arrangements, informed by Hong Kong privacy guidance [3].

## Resources

### 19. What resources have you used so far, and how have they helped?

Published research on Hong Kong youth and university students supports problem definition [1, 2], helping the team focus on the gap between service availability and actual help seeking. Hong Kong privacy guidance provides a reference for reviewing data processing design [3], but does not demonstrate that the system meets the requirements.

Questionnaires have been selected for user research. The technical direction comprises a planned mobile app, speech-to-text, on-device deidentification, cloud GenAI classification, daily summaries, background support need analysis and professional case summaries. Specific frameworks, models and service providers have not been confirmed, and no evaluation results from using such software have been provided.

Technology selection should compare local processing capabilities, language support, retention conditions, costs and maintenance demands on the four-person team. These comparisons should be documented to support later decisions.

### 20. What additional resources do you need?

We need more students to participate in questionnaires, design feedback from social workers or counsellors, privacy and security advice, appropriate professional participation in setting support prompt thresholds, and institutional partners for supervised pilots. Synthetic cases covering mixed topics, multiple conversation attributes, accounts of earlier events, connections across records and identifying details are also needed to evaluate technical performance safely.

| Required resource | Purpose | Proposed stage |
| --- | --- | --- |
| Student recruitment channels and research arrangements | Establish needs and interface understanding. | Before questionnaires and usability evaluation. |
| Social worker or counsellor feedback | Confirm professional summaries, prompt evidence and threshold evaluation methods, and case acceptance flows. | During summary design and prototype revision. |
| Synthetic cases and evaluation rules | Assess deidentification, timelines, conversation attribute classification, links across records and summary fidelity. | Before core feature evaluation. |
| Privacy, security and safeguarding advice | Review data processing and arrangements for different ages. | Before trials with real data. |
| Technology and staffing cost information | Assess maintenance and service sustainability. | During partnership and adoption discussions. |

Progress in obtaining these external resources has not been confirmed. Later updates should name contact owners and report actual outcomes.

## Lessons Learned

### 21. What new insights have you gained about the problem, technology or teamwork?

Our current understanding is that available services do not necessarily mean students can or will use them. Alongside convenient operation, students need to see the purpose of recording, understand where data go and control whether to disclose. Student research must still confirm these ideas.

Technically, GenAI is central to turning free input into organised context. Students should not carry the selection, classification or timeline organisation burden; the system must handle these tasks automatically. Evaluation must still check preservation of meaning, correct handling of content attributes, event times and uncertainty, and separation of student content review from background psychological analysis. AI offers short support prompts at appropriate times, followed by human support after consent to submission.

For teamwork, product and development need shared, explicit data flows and completion criteria. If “stays local,” “deidentification” or “withdraw sharing” remain only conceptual descriptions, the groups may interpret actual behaviour differently. Turning these requirements into flows and evaluation cases is an important next step.

### 22. How has your understanding of the problem changed?

Our understanding now clarifies the division between the everyday interface and help-seeking triggers. Students review daily content through a calendar, while psychological state and trends across days are analysed in the background. Only when AI judges that the support threshold is approaching does it give a short explanation and ask whether to submit.

| Area | Previous document wording | Current direction |
| --- | --- | --- |
| Student interface | View classifications, timelines and support summaries. | Calendar and neutral daily content summaries without AI psychological ratings. |
| AI role | Automatically organise background information. | Provide low intensity recording responses, organise and analyse support cues in the background, and judge prompt timing. |
| Everyday interaction | Response style unspecified. | Brief acknowledgement, encouragement or optional invitations to add context, without repeated questioning; students can end directly. |
| Before submission | Students review and optionally revise the complete summary. | Students make a simple submission choice after a short explanation. |
| Social worker information | A summary version approved by the student. | A professional case summary supplied automatically after consent to submission. |
| New records | Each new shared summary version requires approval. | Later updates and notification remain undecided; repeated approval is not presumed. |

This is the clarified design direction, without questionnaire or trial evidence of effectiveness. Student feedback must validate the interface and prompts, professional participation must assess thresholds and case information, and actual revisions must be recorded.

### 23. What further questions or comments does your team have?

The most pressing questions are whether students will continue free recording, whether calendar review is convenient, whether brief responses help without disturbing them, whether AI can offer support prompts at appropriate times, what case information professionals actually need, and how arrangements should differ for secondary school and university students. The product must also establish whether students understand that cloud transmission and sharing with social workers are different choices.

A live service also depends on organisations' ability to accept cases and respond, and on how waiting, declining, rematching and withdrawal are handled. These arrangements directly affect student expectations and should be designed alongside the core interface.

The next report update should include questionnaire versions and results, prototype demonstrations, technical evaluation records, professional feedback, named owners and dates. The team can then determine which features to retain or adjust and decide the scope of subsequent partnerships and pilots.

## References

[1] HK-YES, Youth Mental Health in Hong Kong: Executive Summary (2019–2022 study, 2023). https://hkyes.hku.hk/_files/ugd/2e2f9b_626b061890704966aef5ee636696e144.pdf?index=true

[2] Sum et al., “Stigma towards mental illness, resilience, and help-seeking behaviours in undergraduate students in Hong Kong,” Early Intervention in Psychiatry (2024). https://pubmed.ncbi.nlm.nih.gov/37438914/

[3] Office of the Privacy Commissioner for Personal Data, Artificial Intelligence: Model Personal Data Protection Framework (2024). https://www.pcpd.org.hk/english/artificial_intelligence/index.html
