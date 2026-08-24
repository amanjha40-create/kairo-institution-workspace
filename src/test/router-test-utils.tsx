import { act, render, waitFor, type RenderResult } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { createMemoryHistory } from "@tanstack/history";
import type { AnyRouter } from "@tanstack/router-core";
import { registerTestCleanup } from "@/test/setup";

type TestHistory = ReturnType<typeof createMemoryHistory>;

type RenderInstitutionRouteResult = RenderResult & {
  router: AnyRouter;
  queryClient: QueryClient;
  history: TestHistory;
};

export async function renderInstitutionRoute(path: string): Promise<RenderInstitutionRouteResult> {
  const { routeTree } = await import("@/routeTree.gen");

  const history = createMemoryHistory({
    initialEntries: [path],
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    scrollRestoration: false,
    defaultPreloadStaleTime: 0,
  });

  const renderResult = render(<RouterProvider router={router} />);

  registerTestCleanup(async () => {
    await act(async () => {
      renderResult.unmount();
      await Promise.resolve();
    });
    await queryClient.cancelQueries();
    queryClient.clear();
    queryClient.unmount();
    history.flush();
    history.destroy();
  });

  await waitFor(() => {
    if (router.state.status === "pending") {
      throw new Error("Router is still pending");
    }
  });

  await waitFor(() => {
    if (queryClient.isFetching() > 0 || queryClient.isMutating() > 0) {
      throw new Error("Route queries are still pending");
    }
  });

  return {
    ...renderResult!,
    router,
    queryClient,
    history,
  };
}
