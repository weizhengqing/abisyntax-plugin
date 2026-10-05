"""Tests for extracting release syntax without executing downloaded sources."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'tools'))
from fetch_qe_syntax import braced_body, derived_parameters, fortran_statements


class CatalogTests(unittest.TestCase):
    def test_continuations_and_quoted_comments(self):
        source = """! NAMELIST / fake / wrong
        namelist / inputepw / prefix, & ! actual comment
          & nbndsub, ep_coupling
        title = 'keep!this'
        #ifdef SOMETHING
        namelist / plot / xemin, xemax
        #endif
        """
        statements = list(fortran_statements(source))
        self.assertEqual(statements, ['namelist / inputepw / prefix,   nbndsub, ep_coupling',
                                      "title = 'keep!this'", 'namelist / plot / xemin, xemax'])

    def test_tcl_braces(self):
        text = r'var name { default {a} info {literal \{ brace} } } trailing'
        body = braced_body(text, 0)
        self.assertEqual(body, r'var name { default {a} info {literal \{ brace} } ')

    def test_derived_type_members(self):
        source = """type input_options
        integer :: max_i, i_min = 1
        real :: mesh(2) = (/1.0, 2.0/)
        character(20) :: prefix='a,b'
        end type input_options
        type(input_options) :: ggwin
        """
        self.assertEqual(derived_parameters(list(fortran_statements(source))),
                         {'ggwin': {'ggwin%max_i', 'ggwin%i_min', 'ggwin%mesh', 'ggwin%prefix'}})


if __name__ == '__main__':
    unittest.main()
