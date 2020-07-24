const { AuthenticationError, ForbiddenError } = require("apollo-server");
const express = require("express");
const bodyParser = require("body-parser");
const { gql, ApolloServer } = require("apollo-server-express");
const { v4 } = require("uuid");
const { openapi } = require("./openapi");

const typeDefs = gql`
  """
  A user in the Meeshkan Bank
  """
  type Client {
    id: ID!
    name: String!
    email: String!
    balanceInEuroCents: Int!
  }
  type Query {
    """
    A list of all clients. Only available to someone
    with root authentication.
    """
    clients: [Client!]!
    me: Client!
  }
  type Mutation {
    """
    Allows one to authenticate as root.
    """
    authenticateAsRoot(
      """
      The root password.
      """
      password: String!
    ): Boolean!
    """
    Send money to a client.
    """
    sendMoney(
      """
      The id of the person we are sending money to.
      """
      who: ID!
      """
      The amount we are sending
      """
      amount: Int!
    ): Client!
    """
    Allows one to authenticate as a client.
    """
    authenticateAsClient(
      """
      The client's email.
      """
      email: String!
      """
      The client's password.
      """
      password: String!
    ): Client!
    """
    Add client.
    """
    addClient(
      """
      The client's email.
      """
      email: String!
      """
      The client's name.
      """
      name: String!
      """
      The client's password.
      """
      password: String!
      """
      The clients initial balance in euro cents
      """
      balanceInEuroCents: Int!
    ): Client!
    """
    Remove a client from the bank
    """
    removeClient(
      """
      The client's id
      """
      id: ID!
    ): Boolean!
    """
    Signs out of all authentication
    """
    signOut: Boolean!
  }
`;

const rootPassword = "pa$$w0rd";
const unauthenticated = "unauthenticated";
const root = "root";

let role = unauthenticated;

const clients = [
  {
    id: "5c9cf5e4-60fa-4069-9728-bb4f660b5364",
    name: "Mike Solomon",
    email: "mike@meeshkan.com",
    password: "not secure",
    balanceInEuroCents: 1492,
  },
  {
    id: "fd800015-6d09-4469-92a2-61d8fd25723f",
    name: "Makenna Smutz",
    email: "makenna@meeshkan.com",
    password: "also not secure",
    balanceInEuroCents: 1493,
  },
];

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
  Query: {
    clients: () => {
     if (role !== root) {
        throw new AuthenticationError("Can only fetch users as root");
      }
      return clients;
    },
    me: () => {
      if (role === root || role === unauthenticated) {
        throw new AuthenticationError("Unauthenticated as client");
      }
      return role;
    },
  },
  Mutation: {
    addClient: (parent, args, context) => {
     /* if (role !== root) {
        throw new AuthenticationError(
          "Must be authenticated as root do add a client"
        );
      }*/
      const newClient = {
        id: v4(),
        name: args.name,
        email: args.email,
        password: args.password,
        balanceInEuroCents: args.balance,
      };
      clients.push(newClient);
      return newClient;
    },
    removeClient: (parent, args, context) => {
     /*if (role !== root) {
        throw new AuthenticationError(
          "Must be authenticated as root do add a client"
        );
      }*/
      let i = 0;
      for (; i < clients.length; i++) {
        if (args.id === clients[i].id) break;
      }
      if (i === clients.length) {
        return false;
      }
      delete clients[i];
      return true;
    },
    authenticateAsRoot: (parent, args, context) => {
      if (args.password === rootPassword) {
        role = root;
        return true;
      }
      throw new AuthenticationError("Incorrect password");
    },
    authenticateAsClient: (parent, args, context) => {
      const client = clients.filter(
        (client) =>
          client.email == args.email && client.password == args.password
      );
      if (client.length > 1) {
        throw new ForbiddenError(
          "The Meeshkan bank is in an inconsistent state. Sorry!"
        );
      }
      if (client.length === 0) {
        throw new AuthenticationError("Email or password incorrect");
      }
      role = client[0];
      return client[0];
    },
    sendMoney: (parent, args, context) => {
      if (role === root || role === unauthenticated) {
        throw new AuthenticationError("Unauthenticated as client");
      }
      const client = clients.filter((client) => client.id == args.who);
      if (client.length > 1) {
        throw new ForbiddenError(
          "The Meeshkan bank is in an inconsistent state. Sorry!"
        );
      }
      if (client.length === 0) {
        throw new AuthenticationError("Could not find a client with id " + id);
      }
      if (role.balanceInEuroCents < args.amount) {
        throw new ForbiddenError(
          "You have insufficient funds to complete this transaction."
        );
      }
      role.balanceInEuroCents -= args.amount;
      client[0].balanceInEuroCents += args.amount;
      return role;
    },
    signOut: () => {
      role = unauthenticated;
      return true;
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

const app = express();
server.applyMiddleware({ app });

app.get("/version", (req, res) => {
  res.json({
    version: "0.0.0",
  });
});

app.get("/openapi", (req, res) => {
  res.json(openapi);
});

app.listen({ port: 4000 }, () =>
  console.log(
    `Server ready at http://localhost:4000 with graphql at http://localhost:4000${server.graphqlPath}
and openapi spec visible at http://localhost:4000/openapi. Have fun!`
  )
);
