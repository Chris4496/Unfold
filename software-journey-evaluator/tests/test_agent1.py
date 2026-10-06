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
    return {'schema_version': 1, 'report_version': 'v1', 'product': {'name': 'Diary', 'understanding': 'A place to keep private notes.'}, 'sources': [{'path': 'README.md', 'kind': 'document', 'claim': 'The product stores notes.'}], 'journeys': [{'role_id': 'student', 'overview': 'Write privately, decide whether to share.'}], 'personas': [{'id': 'student', 'label': 'A busy student', 'card': {'background': 'A student with limited time.', 'digital_familiarity': 'Comfortable using phone apps.', 'privacy_attitude': 'Concerned about sharing.', 'synthetic_material': ['A fictional deadline.'], 'basic_product_info': ['This app keeps a diary.'], 'starting_context': 'After a long school day.', 'open_goal': 'Find a private place to reflect.'}}], 'research_questions': ['How does sharing feel?'], 'assumptions': [], 'limitations': [], 'approval': {'status': 'pending', 'scope': 'Product understanding and persona proposal.'}}


class Agent1Tests(unittest.TestCase):
    def test_source_collection_excludes_secrets_dependencies_history_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'product'
            root.mkdir()
            (root / 'README.md').write_text('A notes product.')
            (root / 'screen.tsx').write_text('export const Screen = () => "Write";')
            for name in ['.env', 'credentials.json', 'screen.test.tsx']:
                (root / name).write_text('PRIVATE-CONTENT')
            for name in ['node_modules', 'test-runs', '.aws']:
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


if __name__ == '__main__':
    unittest.main()
