from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Dict

DEFAULT_MATCH_STATE: Dict[str, Any] = {
    "match": {
        "id": "match-001",
        "status": "live",
        "timer": 1325,
        "series": {"best_of": 5, "score": {"blue": 2, "red": 1}},
        "objective": {
            "turret": {"blue": 3, "red": 2},
            "turtle": {"blue": 1, "red": 0},
            "lord": {"blue": 1, "red": 0},
        },
    },
    "teams": {
        "blue": {
            "name": "Blue Phoenix",
            "short": "BPH",
            "logo": "/assets/teams/blue-phoenix.svg",
            "kills": 9,
            "gold": 18840,
            "gold_diff": 1320,
            "tower": 3,
            "dragons": 1,
        },
        "red": {
            "name": "Red Viper",
            "short": "RVP",
            "logo": "/assets/teams/red-viper.svg",
            "kills": 7,
            "gold": 17520,
            "gold_diff": -1320,
            "tower": 2,
            "dragons": 0,
        },
    },
    "players": [
        {
            "slot": 1,
            "name": "Astra",
            "role": "Jungle",
            "hero": "hero-rose",
            "hero_image": "/assets/heroes/hero-rose.svg",
            "level": 15,
            "kills": 4,
            "deaths": 1,
            "assists": 6,
            "items": [
                "/assets/items/boots.svg",
                "/assets/items/blade.svg",
                "/assets/items/gem.svg",
            ],
            "team": "blue",
        },
        {
            "slot": 2,
            "name": "Vex",
            "role": "Mid",
            "hero": "hero-viper",
            "hero_image": "/assets/heroes/hero-viper.svg",
            "level": 14,
            "kills": 3,
            "deaths": 2,
            "assists": 4,
            "items": [
                "/assets/items/boots.svg",
                "/assets/items/rod.svg",
                "/assets/items/amulet.svg",
            ],
            "team": "red",
        },
    ],
}


class MatchState:
    """A single source of truth for a live MLBB match overlay."""

    def __init__(self, initial_data: Dict[str, Any] | None = None, state_path: str | Path | None = None):
        self.state_path = Path(state_path) if state_path else None
        self._state = copy.deepcopy(DEFAULT_MATCH_STATE)
        if initial_data:
            self._state = self._deep_merge(self._state, initial_data)
        if self.state_path and self.state_path.exists():
            self.load_from_file(self.state_path)

    @staticmethod
    def _deep_merge(base: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
        merged = copy.deepcopy(base)
        for key, value in updates.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = MatchState._deep_merge(merged[key], value)
            else:
                merged[key] = copy.deepcopy(value)
        return merged

    def set_value(self, path: list[str], value: Any) -> None:
        node = self._state
        for key in path[:-1]:
            if key not in node or not isinstance(node[key], dict):
                node[key] = {}
            node = node[key]
        node[path[-1]] = copy.deepcopy(value)

    def apply_update(self, updates: Dict[str, Any]) -> None:
        self._state = self._deep_merge(self._state, updates)

    def load_from_file(self, file_path: str | Path) -> None:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"State file not found: {path}")
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        self._state = self._deep_merge(self._state, data)

    def save_to_file(self, file_path: str | Path | None = None) -> None:
        target = Path(file_path) if file_path else self.state_path
        if target is None:
            raise ValueError("No file path provided for match state save.")
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("w", encoding="utf-8") as handle:
            json.dump(self._state, handle, indent=2)

    def to_dict(self) -> Dict[str, Any]:
        return copy.deepcopy(self._state)

    def get(self, path: list[str], default: Any = None) -> Any:
        node = self._state
        for key in path:
            if not isinstance(node, dict) or key not in node:
                return default
            node = node[key]
        return node

    def tick_timer(self, delta: int = 1) -> None:
        self.set_value(["match", "timer"], max(0, self.get(["match", "timer"], 0) + delta))

    def set_team_stat(self, team: str, metric: str, value: Any) -> None:
        self.set_value(["teams", team, metric], value)

    def set_player_stat(self, slot: int, key: str, value: Any) -> None:
        for player in self._state["players"]:
            if player.get("slot") == slot:
                player[key] = value
                return
        raise KeyError(f"Player slot {slot} not found")

    def snapshot(self) -> Dict[str, Any]:
        return self.to_dict()
