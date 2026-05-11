import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { card, NAVY, TEXT_MUTED, BORDER_LIGHT } from "@/components/profile/theme";

type Props = {
  name: string;
  age: string;
  gender: string;
  email: string;
  photoUri: string | null;
  uploading?: boolean;
  onEdit: () => void;
  onPhotoPress: () => void;
};

export default function ProfileHeaderCard({
  name,
  age,
  gender,
  email,
  photoUri,
  uploading,
  onEdit,
  onPhotoPress,
}: Props) {
  return (
    <View style={card.base}>
      <Pressable style={s.editBtn} onPress={onEdit} hitSlop={10}>
        <View style={s.editCircle}>
          <Ionicons name="create-outline" size={16} color={NAVY} />
        </View>
      </Pressable>

      <View style={s.row}>
        <Pressable onPress={onPhotoPress} disabled={uploading}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Ionicons name="person-outline" size={32} color="#94a3b8" />
            </View>
          )}
          {uploading ? (
            <View style={s.uploadingOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <View style={s.cameraBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          )}
        </Pressable>

        <View style={s.info}>
          <Text style={s.name}>{name}</Text>
          {age ? <Text style={s.sub}>{age} years</Text> : null}
          {gender ? <Text style={s.sub}>{gender}</Text> : null}
          <Text style={s.sub}>{email}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    marginLeft: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 2,
  },
  sub: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 20,
  },
  editBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 1,
  },
  editCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
});
