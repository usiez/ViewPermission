
const { findByProps, findByStoreName } = vendetta.metro;
const { before, after } = vendetta.patcher;
const { showToast } = vendetta.ui.toasts;
const { React, ReactNative } = vendetta.metro.common;

const {
    View, Text, ScrollView, Modal, Pressable, StyleSheet
} = ReactNative;

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const RowModule = findByProps("ActionSheetRow");
const ActionSheetRow = RowModule?.ActionSheetRow;
const ChannelStore = findByStoreName("ChannelStore");
const GuildRoleStore = findByStoreName("GuildRoleStore");

const PERMISSIONS = [
    [0n, "Create Invite"],
    [1n, "Kick Members"],
    [2n, "Ban Members"],
    [3n, "Administrator"],
    [4n, "Manage Channels"],
    [5n, "Manage Server"],
    [6n, "Add Reactions"],
    [7n, "View Audit Log"],
    [10n, "View Channels"],
    [11n, "Send Messages"],
    [12n, "Send TTS Messages"],
    [13n, "Manage Messages"],
    [14n, "Embed Links"],
    [15n, "Attach Files"],
    [16n, "Read Message History"],
    [17n, "Mention Everyone"],
    [18n, "Use External Emojis"],
    [20n, "Connect"],
    [21n, "Speak"],
    [22n, "Mute Members"],
    [23n, "Deafen Members"],
    [24n, "Move Members"],
    [25n, "Use Voice Activity"],
    [26n, "Change Nickname"],
    [27n, "Manage Nicknames"],
    [28n, "Manage Roles"],
    [29n, "Manage Webhooks"],
    [30n, "Manage Expressions"],
    [31n, "Use Application Commands"],
    [32n, "Request to Speak"],
    [33n, "Manage Events"],
    [34n, "Manage Threads"],
    [35n, "Create Public Threads"],
    [36n, "Create Private Threads"],
    [37n, "Use External Stickers"],
    [38n, "Send Messages in Threads"],
    [39n, "Use Activities"],
    [40n, "Moderate Members"],
    [42n, "Use Soundboard"],
    [43n, "Create Expressions"],
    [44n, "Create Events"],
    [45n, "Use External Sounds"],
    [46n, "Send Voice Messages"],
    [49n, "Send Polls"]
];

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.75)",
        justifyContent: "center",
        padding: 16
    },
    panel: {
        maxHeight: "85%",
        backgroundColor: "#232428",
        borderRadius: 12,
        padding: 16
    },
    title: {
        color: "#ffffff",
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 12
    },
    role: {
        backgroundColor: "#313338",
        borderRadius: 8,
        padding: 12,
        marginBottom: 10
    },
    roleName: {
        color: "#ffffff",
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 8
    },
    permission: {
        color: "#b5bac1",
        fontSize: 13,
        marginBottom: 4
    },
    close: {
        backgroundColor: "#5865f2",
        padding: 12,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 8
    },
    closeText: {
        color: "#ffffff",
        fontWeight: "bold"
    },
    empty: {
        color: "#b5bac1",
        paddingVertical: 12
    }
});

let setVisible;
let setGuildData;
let unpatches = [];

function openViewer(guildId) {
    try {
        const roles = GuildRoleStore?.getSortedRoles?.(guildId);

        if (!roles?.length) {
            showToast("Could not load server roles", "error");
            return;
        }

        setGuildData?.({
            id: guildId,
            roles: [...roles].reverse()
        });
        setVisible?.(true);
    } catch (e) {
        console.error("[PermissionsViewer]", e);
        showToast("Failed to load permissions", "error");
    }
}

function PermissionModal() {
    const [visible, setOpen] = React.useState(false);
    const [guild, setGuild] = React.useState(null);

    React.useEffect(() => {
        setVisible = setOpen;
        setGuildData = setGuild;

        return () => {
            setVisible = null;
            setGuildData = null;
        };
    }, []);

    return React.createElement(
        Modal,
        {
            visible,
            transparent: true,
            animationType: "fade",
            onRequestClose: () => setOpen(false)
        },
        React.createElement(
            View,
            { style: styles.overlay },
            React.createElement(
                View,
                { style: styles.panel },
                React.createElement(
                    Text,
                    { style: styles.title },
                    "Server Permissions"
                ),
                React.createElement(
                    ScrollView,
                    null,
                    ...(guild?.roles || []).map((role, index) => {
                        let bits = 0n;

                        try {
                            bits = BigInt(role.permissions ?? 0);
                        } catch (_) {}

                        const granted = PERMISSIONS.filter(
                            ([bit]) => (bits & (1n << bit)) !== 0n
                        );

                        return React.createElement(
                            View,
                            { key: role.id || index, style: styles.role },
                            React.createElement(
                                Text,
                                {
                                    style: [
                                        styles.roleName,
                                        role.colorString
                                            ? { color: role.colorString }
                                            : {}
                                    ]
                                },
                                role.name || "Unknown Role"
                            ),
                            granted.length
                                ? ...[]
                                : null
                        );
                    })
                ),
                React.createElement(
                    Pressable,
                    {
                        style: styles.close,
                        onPress: () => setOpen(false)
                    },
                    React.createElement(
                        Text,
                        { style: styles.closeText },
                        "Close"
                    )
                )
            )
        )
    );
}

function patchActionSheet() {
    if (!LazyActionSheet?.openLazy || !ActionSheetRow) {
        console.error("[PermissionsViewer] Action sheet modules unavailable");
        return null;
    }

    return before("openLazy", LazyActionSheet, ([component, key, msg]) => {
        if (key !== "MessageLongPressActionSheet") return;

        const message = msg?.message;
        if (!message?.channel_id) return;

        const channel = ChannelStore?.getChannel?.(message.channel_id);
        const guildId = channel?.guild_id;
        if (!guildId) return;

        component.then(instance => {
            const unpatch = after("default", instance, (_, tree) => {
                try {
                    const findInTree = vendetta.utils.findInReactTree;
                    const buttons = findInTree(tree, node =>
                        Array.isArray(node) &&
                        node.some(item =>
                            item?.props?.label === "Reply" ||
                            item?.props?.label === "Reply to Message"
                        )
                    );

                    if (!buttons) return tree;

                    if (buttons.some(item =>
                        item?.props?.label === "View Permissions"
                    )) return tree;

                    const button = React.createElement(ActionSheetRow, {
                        label: "View Permissions",
                        onPress: () => {
                            LazyActionSheet.hideActionSheet();
                            openViewer(guildId);
                        }
                    });

                    buttons.push(button);
                    return tree;
                } catch (e) {
                    console.error("[PermissionsViewer] Menu patch error", e);
                    return tree;
                } finally {
                    unpatch();
                }
            });

            unpatches.push(unpatch);
        });
    });
}

module.exports = {
    onLoad() {
        console.log("[PermissionsViewer] Loading");

        if (!GuildRoleStore || !ChannelStore) {
            showToast("Required Discord stores unavailable", "error");
            return;
        }

        const patch = patchActionSheet();
        if (patch) unpatches.push(patch);

        showToast("PermissionsViewer loaded", "success");
    },

    onUnload() {
        unpatches.forEach(unpatch => {
            try { unpatch(); } catch (_) {}
        });
        unpatches = [];
        setVisible = null;
        setGuildData = null;
    },

    Settings: PermissionModal
};
