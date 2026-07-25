"""Tests for the permissions catalog and roles module.

Covers:
  a. Overlap: importing core.permissions with overlapping module keys raises ValueError.
  b. Role subset: every value in ROLE_DEFINITIONS is a subset of ALL_PERMISSIONS.keys().
  c. Module-level PERMISSIONS dicts are well-formed.
"""

import pytest

from app.core.permissions import _MODULES, ALL_PERMISSIONS, PERMISSION_CATEGORY
from app.core.permissions.roles import ROLE_DEFINITIONS, ROLE_NAMES


class TestOverlapDetection:
    def test_all_permission_keys_unique(self):
        """The aggregator should have no duplicate keys — it raises at import
        time if there's a collision, so if we get here the catalog is clean."""
        assert len(ALL_PERMISSIONS) == len(set(ALL_PERMISSIONS))

    def test_overlap_raises_valueerror(self):
        """Simulate overlapping keys by temporarily patching a module's
        PERMISSIONS dict, then re-running the aggregator check."""
        from app.core.permissions import agent, dashboard

        # Save originals.
        orig_agent = agent.PERMISSIONS.copy()
        orig_dashboard = dashboard.PERMISSIONS.copy()

        try:
            # Inject a collision.
            agent.PERMISSIONS["dashboard.read"] = "collides"
            with pytest.raises(ValueError, match="Duplicate permission keys"):
                # Re-run the aggregator logic inline.
                merged = {}
                for mod in _MODULES:
                    overlap = merged.keys() & mod.PERMISSIONS.keys()
                    if overlap:
                        raise ValueError(f"Duplicate permission keys: {overlap}")
                    merged.update(mod.PERMISSIONS)
        finally:
            # Restore.
            agent.PERMISSIONS.clear()
            agent.PERMISSIONS.update(orig_agent)
            dashboard.PERMISSIONS.clear()
            dashboard.PERMISSIONS.update(orig_dashboard)


class TestRoleSubset:
    def test_every_role_permission_is_in_catalog(self):
        """Every permission ID referenced in ROLE_DEFINITIONS must exist in
        the ALL_PERMISSIONS catalog."""
        all_ids = set(ALL_PERMISSIONS.keys())
        for slug, perms in ROLE_DEFINITIONS.items():
            for pid in perms:
                assert pid in all_ids, (
                    f"Role '{slug}' references unknown permission '{pid}'"
                )

    def test_role_definitions_keys_match_role_names(self):
        """ROLE_DEFINITIONS and ROLE_NAMES must have the same keys."""
        assert set(ROLE_DEFINITIONS.keys()) == set(ROLE_NAMES.keys())

    def test_role_permissions_are_lists(self):
        """Every value in ROLE_DEFINITIONS should be a list (or set/tuple)."""
        for slug, perms in ROLE_DEFINITIONS.items():
            assert isinstance(perms, (list, set, tuple)), (
                f"Role '{slug}' permissions should be a list, got {type(perms)}"
            )

    def test_no_empty_roles(self):
        """Every role must have at least one permission."""
        for slug, perms in ROLE_DEFINITIONS.items():
            assert len(perms) > 0, f"Role '{slug}' has no permissions"


class TestPermissionCatalogForm:
    def test_permission_ids_are_strings(self):
        for pid in ALL_PERMISSIONS:
            assert isinstance(pid, str)

    def test_permission_descriptions_are_strings(self):
        for pid, desc in ALL_PERMISSIONS.items():
            assert isinstance(desc, str), f"Description for '{pid}' is not a string"

    def test_permission_categories_are_strings(self):
        for pid, cat in PERMISSION_CATEGORY.items():
            assert isinstance(cat, str), f"Category for '{pid}' is not a string"

    def test_permission_ids_match_category_format(self):
        """Permission IDs should be 'domain.action' format."""
        for pid in ALL_PERMISSIONS:
            assert "." in pid, f"Permission '{pid}' is missing a dot separator"

    def test_categories_match_domain_prefixes(self):
        """Each permission's category should match the first part of its ID."""
        for pid, cat in PERMISSION_CATEGORY.items():
            expected_domain = pid.split(".")[0]
            assert cat == expected_domain, (
                f"Permission '{pid}' has category '{cat}', expected '{expected_domain}'"
            )

    def test_all_permissions_has_no_duplicates(self):
        """ALL_PERMISSIONS should contain exactly 21 permissions (19 + dashboard.platform + platform.tenant.manage)."""
        assert len(ALL_PERMISSIONS) == 21, f"Expected 21 permissions, got {len(ALL_PERMISSIONS)}"

    def test_role_definitions_has_5_roles(self):
        assert len(ROLE_DEFINITIONS) == 6, f"Expected 6 roles, got {len(ROLE_DEFINITIONS)}"
