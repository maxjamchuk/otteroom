import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { MemoryRouter } from "expo-router";
import VotingScreen from "../../app/voting";

jest.mock("@/stores/room.store", () => ({
  useRoomStore: () => ({
    room: { status: "voting", current_movie_id: 123, id: "r1" },
  }),
}));

jest.mock("@/stores/voting.store", () => ({
  useVotingStore: () => ({
    castVote: jest.fn(),
    isVoting: false,
    match: null,
  }),
}));

describe("Voting screen render", () => {
  it("shows movie ID and like/dislike buttons", () => {
    const { getByText } = render(
      <MemoryRouter>
        <VotingScreen />
      </MemoryRouter>
    );

    expect(getByText(/Movie ID: 123/)).toBeTruthy();
    expect(getByText(/Like/)).toBeTruthy();
    expect(getByText(/Dislike/)).toBeTruthy();
  });
});
