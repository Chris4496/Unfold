import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'agent1.py'
SPEC = importlib.util.spec_from_file_location('agent1', SCRIPT)
agent1 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(agent1)


def report():
    return {'schema_version': 2, 'user_agent_count': 1, 'report_version': 'v1', 'product': {'name': 'Diary', 'understanding': 'A place to keep private notes.'}, 'sources': [{'path': 'README.md', 'kind': 'document', 'claim': 'The product stores notes.'}], 'journeys': [{'role_id': 'student', 'overview': 'Write privately, decide whether to share.'}], 'personas': [{'id': 'student', 'label': 'A busy student', 'card': {'background': 'A student with limited time.', 'digital_familiarity': 'Comfortable using phone apps.', 'privacy_attitude': 'Concerned about sharing.', 'synthetic_material': ['A fictional deadline.'], 'basic_product_info': ['This app keeps a diary.'], 'starting_context': 'After a long school day.', 'open_goal': 'Find a private place to reflect.'}}], 'research_questions': ['How does sharing feel?'], 'assumptions': [], 'limitations': [], 'approval': {'status': 'pending', 'scope': 'Product understanding and persona proposal.'}}


def execution():
    return {
        'schema_version': 1, 'report_version': 'v1', 'plan_version': 'p1',
        'checks': [{'area': 'Input', 'status': 'limited', 'detail': 'Use text to represent speech.', 'constraint_ids': ['input-1']}],
        'constraints': [{'id': 'input-1', 'type': 'substitution', 'summary': 'Text replaces speech.', 'affected_roles': ['student'], 'options': [
            {'id': 'type', 'label': 'Type speech', 'method': 'Use the existing text entry.', 'evidence_boundary': 'No audio or transcription conclusions.', 'can_start': True},
            {'id': 'pause', 'label': 'Pause', 'method': 'Wait for an audio environment.', 'evidence_boundary': 'No observations until resolved.', 'can_start': False}
        ]}]
    }


def decisions():
    confirmation = {'status': 'confirmed', 'message': 'I confirm the presented proposal and choices.', 'source_ref': 'original-user-message-42', 'timestamp': '2026-10-06T21:00:00+08:00'}
    return {'report_version': 'v1', 'plan_version': 'p1', 'persona_confirmation': copy.deepcopy(confirmation), 'execution_confirmation': copy.deepcopy(confirmation), 'constraint_choices': [{'constraint_id': 'input-1', 'option_id': 'type'}]}


class Agent1Tests(unittest.TestCase):
    def test_source_collection_excludes_secrets_dependencies_history_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'product'
            root.mkdir()
            (root / 'README.md').write_text('A notes product.')
            (root / 'screen.tsx').write_text('export const Screen = () => "Write";')
            for name in ['.env', 'credentials.json', 'screen.test.tsx']:
                (root / name).write_text('PRIVATE-CONTENT')
            for name in ['node_modules', 'test-runs', '.aws', 'archive', 'workbuddy']:
                (root / name).mkdir()
                (root / name / 'data.json').write_text('PRIVATE-CONTENT')
            outside = Path(directory) / 'outside.md'
            outside.write_text('PRIVATE-CONTENT')
            (root / 'linked.md').symlink_to(outside)
            (root / 'linked-directory').symlink_to(Path(directory), target_is_directory=True)
            packet = agent1.prepare_sources(root)
            self.assertEqual({source['path'] for source in packet['sources']}, {'README.md', 'screen.tsx'})
            self.assertNotIn('PRIVATE-CONTENT', json.dumps(packet))
            self.assertEqual(packet['status'], 'awaiting_agent1_analysis')

    def test_source_limits_are_bounded_and_truncation_is_visible(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'README.md').write_text('a' * 100)
            (root / 'screen.js').write_text('b' * 100)
            packet = agent1.prepare_sources(root, max_file_bytes=20, max_total_bytes=30)
            self.assertEqual(packet['captured_bytes'], 30)
            self.assertTrue(all(source['truncated'] for source in packet['sources']))
            self.assertTrue(any(item['reason'] == 'truncated_content' for item in packet['omissions']))

    def test_valid_proposal_remains_pending(self):
        proposal = report()
        original = copy.deepcopy(proposal)
        self.assertEqual(agent1.validate_report(proposal), [])
        self.assertEqual(proposal, original)

    def test_persona_cannot_receive_researcher_fields(self):
        for field in ['source_paths', 'expected_results', 'test_steps', 'known_defects', 'research_questions']:
            proposal = report()
            proposal['personas'][0]['card'][field] = ['An answer from the analyst.']
            self.assertTrue(agent1.validate_report(proposal))

    def test_missing_or_duplicate_roles_and_mismatched_journeys_are_rejected(self):
        for change in ['missing', 'duplicate', 'unknown']:
            proposal = report()
            if change == 'missing':
                proposal['personas'] = []
            elif change == 'duplicate':
                proposal['personas'].append(copy.deepcopy(proposal['personas'][0]))
            else:
                proposal['journeys'][0]['role_id'] = 'someone-else'
            self.assertTrue(agent1.validate_report(proposal))

    def test_agent_cannot_claim_user_approval(self):
        proposal = report()
        proposal['approval']['status'] = 'approved'
        self.assertTrue(agent1.validate_report(proposal))

    def test_malformed_nested_values_are_diagnostics_not_exceptions(self):
        for key, value in [('product', None), ('personas', [None]), ('journeys', [{}]), ('sources', [{'path': 'x', 'claim': 'y', 'kind': []}]), ('approval', 'approved'), ('schema_version', True)]:
            proposal = report()
            proposal[key] = value
            self.assertTrue(agent1.validate_report(proposal))

    def test_prepare_cli_does_not_overwrite_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'product'
            root.mkdir()
            (root / 'README.md').write_text('A notes product.')
            output = Path(directory) / 'context.json'
            self.assertEqual(agent1.main(['prepare', str(root), '--output', str(output)]), 0)
            snapshot = output.read_bytes()
            self.assertEqual(agent1.main(['prepare', str(root), '--output', str(output)]), 2)
            self.assertEqual(output.read_bytes(), snapshot)


    def test_explicit_user_count_must_match_roster_and_exclude_support_agents(self):
        for count in [None, True, 0, 2, '1']:
            proposal = report()
            proposal['user_agent_count'] = count
            self.assertTrue(agent1.validate_report(proposal))

    def test_start_checks_accept_declared_two_gates_without_mutating_inputs(self):
        values = (report(), execution(), decisions())
        snapshot = copy.deepcopy(values)
        self.assertEqual(agent1.validate_start(*values), [])
        self.assertEqual(values, snapshot)

    def test_blanket_or_posthoc_approval_cannot_replace_either_gate(self):
        for gate in ['persona_confirmation', 'execution_confirmation']:
            for state in ['pending', 'limited', 'posthoc', None]:
                decision = decisions()
                decision[gate]['status'] = state
                self.assertTrue(agent1.validate_start(report(), execution(), decision))
            decision = decisions()
            del decision[gate]
            self.assertTrue(agent1.validate_start(report(), execution(), decision))

    def test_every_constraint_needs_a_real_option_selection_and_scope_boundary(self):
        for choice in [[], [{'constraint_id': 'input-1', 'option_id': 'unknown'}], [{'constraint_id': 'other', 'option_id': 'type'}]]:
            decision = decisions()
            decision['constraint_choices'] = choice
            self.assertTrue(agent1.validate_start(report(), execution(), decision))
        plan = execution()
        del plan['constraints'][0]['options'][0]['evidence_boundary']
        self.assertTrue(agent1.validate_start(report(), plan, decisions()))

    def test_pause_and_stale_versions_prevent_start(self):
        decision = decisions()
        decision['constraint_choices'][0]['option_id'] = 'pause'
        self.assertTrue(agent1.validate_start(report(), execution(), decision))
        for field in ['report_version', 'plan_version']:
            decision = decisions()
            decision[field] = 'old'
            self.assertTrue(agent1.validate_start(report(), execution(), decision))

    def test_ready_environment_still_requires_both_confirmations(self):
        plan = execution()
        plan['checks'][0].update(status='ready', constraint_ids=[])
        plan['constraints'] = []
        decision = decisions()
        decision['constraint_choices'] = []
        self.assertEqual(agent1.validate_start(report(), plan, decision), [])
        del decision['execution_confirmation']
        self.assertTrue(agent1.validate_start(report(), plan, decision))

    def test_unmapped_limits_and_missing_human_sources_are_rejected(self):
        plan = execution()
        plan['checks'][0]['constraint_ids'] = []
        self.assertTrue(agent1.validate_start(report(), plan, decisions()))
        for field in ['source_ref', 'message', 'timestamp']:
            decision = decisions()
            del decision['persona_confirmation'][field]
            self.assertTrue(agent1.validate_start(report(), execution(), decision))

    def test_malformed_start_inputs_and_untimed_approval_return_diagnostics(self):
        for value in [None, [], 'approved']:
            self.assertTrue(agent1.validate_start(report(), value, decisions()))
            self.assertTrue(agent1.validate_start(report(), execution(), value))
        for key, value in [('constraints', [None]), ('checks', [None]), ('constraints', [{'id': []}]), ('checks', [{'area': 'x', 'detail': 'y', 'status': []}])]:
            plan = execution()
            plan[key] = value
            self.assertTrue(agent1.validate_start(report(), plan, decisions()))
        decision = decisions()
        decision['execution_confirmation']['timestamp'] = '2026-10-06T21:00:00'
        self.assertTrue(agent1.validate_start(report(), execution(), decision))


if __name__ == '__main__':
    unittest.main()
