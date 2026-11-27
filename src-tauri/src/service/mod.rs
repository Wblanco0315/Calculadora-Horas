//! Business logic per domain. Services talk to OpenProject through `crate::openproject`.

pub(crate) mod attachment;
pub(crate) mod board;
pub(crate) mod board_move;
pub(crate) mod connection;
pub(crate) mod mcp;
pub(crate) mod mcp_api;
pub(crate) mod mcp_contract;
pub(crate) mod project;
pub(crate) mod report;
pub(crate) mod statistic;
pub(crate) mod ticket;
pub(crate) mod ticket_context;
pub(crate) mod time_entry;
pub(crate) mod window;
pub(crate) mod work_package;
pub(crate) mod work_package_edit;
