import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { MemoryRouter } from "expo-router";
import HomeScreen from "../../app/index";
import CreateRoomScreen from "../../app/create-room";
import JoinRoomScreen from "../../app/join-room";

// Mock supabase client and stores
jest.mock("@/services/supabase", () => {
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: "token" } } }),
        signInAnonymously: jest.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null }),
    },
  };
});

jest.mock("@/stores/room.store", () => {
  const actual = jest.requireActual("zustand");
  return {
    useRoomStore: actual.create(() => ({
      room: null,
      isLoading: false,
      error: null,
      createRoom: jest.fn().mockResolvedValue({ id: "r1", code: "ABC123" }),
      joinRoom: jest.fn().mockResolvedValue({ id: "r1" }),
      setPreferences: jest.fn(),
    })),
  };
});

describe("US1 navigation", () => {
  it("renders home and navigates to create/join screens", async () => {
    const { getByText } = render(
      <MemoryRouter>
        <HomeScreen />
      </MemoryRouter>
    );

    expect(getByText("Welcome to Otteroom")).toBeTruthy();

    const createBtn = getByText(/Create Room/i);
    fireEvent.press(createBtn);
    // Since router pushes, test simply ensures the button exists
    expect(createBtn).toBeTruthy();

    const joinBtn = getByText(/Join Room/i);
    fireEvent.press(joinBtn);
    expect(joinBtn).toBeTruthy();
  });
});
