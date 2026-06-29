import unittest


def autofl_subject(value):
    return value - 2


class AutoFLFailureTest(unittest.TestCase):
    def test_autofl_e2e_failure(self):
        self.assertEqual(
            autofl_subject(3),
            5,
            "AUTOFL_E2E_FAILURE",
        )


if __name__ == "__main__":
    unittest.main()
