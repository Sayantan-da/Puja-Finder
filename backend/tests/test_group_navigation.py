from app.services.group_navigation import (
    create_group,
    get_group_snapshot,
    join_group_with_code,
    update_destination,
    update_member_location,
)


def test_group_creation_join_and_destination_sync():
    group = create_group(
        "user-1",
        "North Kolkata Pandal Rush",
        {
            "pandalId": "p-101",
            "name": "Sova Bagan",
            "latitude": 22.5726,
            "longitude": 88.3639,
            "address": "Sova Bagan, Kolkata",
        },
    )

    assert len(group["joinCode"]) == 6
    assert group["members"]["user-1"]["isOnline"] is True
    assert group["destination"]["name"] == "Sova Bagan"

    joined = join_group_with_code("user-2", group["joinCode"])
    assert joined["groupId"] == group["groupId"]
    assert "user-2" in joined["members"]

    destination = update_destination(
        group["groupId"],
        "user-2",
        {
            "pandalId": "p-202",
            "name": "Baghbazar Durga Puja",
            "latitude": 22.586,
            "longitude": 88.38,
            "address": "Baghbazar, Kolkata",
        },
    )
    assert destination["destination"]["name"] == "Baghbazar Durga Puja"
    assert destination["destination"]["setBy"] == "user-2"

    snapshot = update_member_location(
        group["groupId"],
        "user-1",
        {"latitude": 22.574, "longitude": 88.365},
    )
    assert snapshot["members"]["user-1"]["latitude"] == 22.574
    assert snapshot["members"]["user-1"]["etaMinutes"] >= 0

    full = get_group_snapshot(group["groupId"])
    assert full["groupId"] == group["groupId"]
    assert full["destination"]["name"] == "Baghbazar Durga Puja"
