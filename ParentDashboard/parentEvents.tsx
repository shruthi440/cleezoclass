import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Image,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, NavigationProp } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { createAppStyles } from "../App.styles";
import ParentFooter from './ParentFooter';

const API_BASE = "https://cleezoclass.com:4000/api";

/* ---------------- TYPES ---------------- */

type Poster = {
  id: string | number;
  templateId?: string;
  templatePath?: string;
  eventDate?: string;
  eventTime?: string;
  className?: string;
  section?: string;
};

type PosterCard = Poster & {
  posterType: string;
  previewUrl: string;
};

type RawPoster = Record<string, any>;

type RootStackParamList = {
  Login: undefined;
};

/* ---------------- HELPERS ---------------- */

const formatDateLabel = (value?: string): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTimeLabel = (value?: string): string => {
  if (!value || typeof value !== "string") return "--";
  const parts = value.split(":");
  return `${String(parts[0] || "00").padStart(2, "0")}:${String(
    parts[1] || "00"
  ).padStart(2, "0")}`;
};

const normalizePoster = (item: RawPoster): Poster => ({
  id: item?.id ?? item?.poster_id ?? item?.template_id ?? `${Date.now()}-${Math.random()}`,
  templateId: item?.templateId ?? item?.template_id ?? "",
  templatePath: item?.templatePath ?? item?.template_path ?? "",
  eventDate: item?.eventDate ?? item?.event_date ?? "",
  eventTime: item?.eventTime ?? item?.event_time ?? "",
  className: item?.className ?? item?.class_name ?? "",
  section: item?.section ?? "",
});

/* ---------------- COMPONENT ---------------- */

const ParentHomepage: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { width, height } = useWindowDimensions();
  const phoneWidth = Math.min(Math.max(width - 24, 320), 390);
  const phoneHeight = Math.min(Math.max(height - 24, 720), 860);
  const appStyles = createAppStyles({ phoneWidth, phoneHeight });

  const [name, setName] = useState<string>("Parent");
  const [schoolCode, setSchoolCode] = useState<string>("");
  const [username, setUsername] = useState<string>("");

  const [posters, setPosters] = useState<Poster[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  /* ---------------- STORAGE ---------------- */

  useEffect(() => {
    const loadStorage = async () => {
      const n = (await AsyncStorage.getItem("name")) ?? "Parent";
      const sc = (await AsyncStorage.getItem("schoolCode")) ?? "";
      const u = (await AsyncStorage.getItem("username")) ?? "";

      setName(n);
      setSchoolCode(sc);
      setUsername(u);
    };

    loadStorage();
  }, []);

  /* ---------------- URL RESOLVER ---------------- */

  const resolvePosterUrl = (path?: string): string => {
    if (!path || typeof path !== "string") return "";
    if (path.startsWith("http")) return path;
    return `https://cleezoclass.com/${path}`;
  };

  /* ---------------- MEMO ---------------- */

  const posterCards: PosterCard[] = useMemo(() => {
    return posters.map((item) => {
      const templateId = String(item.templateId ?? "").toLowerCase();
      const posterType = templateId.startsWith("birthday")
        ? "Birthday"
        : "Event";

      return {
        ...item,
        posterType,
        previewUrl: resolvePosterUrl(item.templatePath),
      };
    });
  }, [posters]);

  /* ---------------- API ---------------- */

  useEffect(() => {
    if (!schoolCode) {
      setError("School code missing");
      return;
    }

    let active = true;

    const loadPosters = async () => {
      setLoading(true);
      setError("");

      try {
        const queryParts = [
          `schoolCode=${encodeURIComponent(schoolCode)}`,
          `limit=20`,
        ];
        if (username) queryParts.push(`username=${encodeURIComponent(username)}`);
        if (name) queryParts.push(`studentName=${encodeURIComponent(name)}`);

        const res = await fetch(`${API_BASE}/admin-event-posters?${queryParts.join("&")}`);

        const json = await res.json();

        if (!res.ok) throw new Error(json?.message || "Error");

        const rawList = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.posters)
          ? json.posters
          : [];

        const normalized = rawList.map(normalizePoster);
        if (active) setPosters(normalized);
      } catch (err: any) {
        if (active) setError(err?.message || "Failed to load events");
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPosters();
    const interval = setInterval(loadPosters, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [schoolCode, username, name]);

  /* ---------------- LOGOUT ---------------- */

  const handleLogout = async () => {
    await AsyncStorage.clear();
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  /* ---------------- RENDER ITEM ---------------- */

  const renderItem = ({ item }: { item: PosterCard }) => (
    <View style={styles.posterCard}>
      <View style={styles.row}>
        <Text style={styles.bold}>{item.posterType}</Text>
        <Text>{formatDateLabel(item.eventDate)}</Text>
      </View>

      <View style={styles.posterContainer}>
        {item.previewUrl ? (
          <WebView
            source={{ uri: item.previewUrl }}
            style={styles.webview}
          />
        ) : (
          <Text>Preview unavailable</Text>
        )}
      </View>

      <View style={styles.row}>
        <Text>
          Class {item.className || "-"}-{item.section || "-"}
        </Text>
        <Text>Time {formatTimeLabel(item.eventTime)}</Text>
      </View>
    </View>
  );

  /* ---------------- UI ---------------- */

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 12 }}>
          <View style={appStyles.heroCard}>
            <Image
              source={require("../assets/StudentReport.png")}
              style={appStyles.heroImage}
              resizeMode="cover"
            />
          </View>

          <View style={appStyles.moduleHeaderCard}>
            <View style={appStyles.moduleHeaderTopRow}>
              <View style={appStyles.moduleHeaderTextBlock}>
                <Text style={appStyles.moduleHeaderTitle}>Announcements</Text>
                <Text style={appStyles.moduleHeaderSubtitle}>
                  School notices and poster updates for parents.
                </Text>
              </View>
              <View style={appStyles.moduleHeaderBadge}>
                <Text style={appStyles.moduleHeaderBadgeText}>{posterCards.length} Posts</Text>
              </View>
            </View>
          </View>

          <View style={styles.posterCard}>
            <View style={styles.row}>
              <Text style={styles.bold}>Parent Homepage</Text>
              <Text>{schoolCode || "N/A"}</Text>
            </View>
            <Text>Welcome, {name}</Text>
          </View>

          {loading && <ActivityIndicator size="large" />}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <FlatList
            data={posterCards}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 12 }}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <Text style={{ color: "#fff" }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <ParentFooter />
    </SafeAreaView>
  );
};

export default ParentHomepage;

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f4f6f9",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0a3d62",
  },
  posterCard: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginVertical: 8,
  },
  posterContainer: {
    height: 150,
    marginVertical: 8,
    overflow: "hidden",
  },
  webview: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bold: {
    fontWeight: "bold",
  },
  button: {
    marginTop: 10,
    padding: 12,
    backgroundColor: "#0a3d62",
    alignItems: "center",
    borderRadius: 8,
  },
  error: {
    color: "red",
  },
});
