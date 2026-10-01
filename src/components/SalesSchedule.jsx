                                                  appointment={
                                                    appointment
                                                  }
                                                  onSelect={
                                                    onSelectAppointment
                                                  }
                                                />

                                              </React.Fragment>
                                            )
                                          }
                                        )
                                      ) : (
                                        <span className="sales-schedule-no-appointments">
                                          No appointments
                                        </span>
                                      )}

                                    </div>
                                  </div>

                                </div>
                              )
                            }
                          )}
                      </React.Fragment>
                    )
                  }
                )}

                {/* UNASSIGNED */}

                {unassigned.length > 0 && (
                  <>
                    <div className="sales-schedule-branch">
                      <button
                        type="button"
                        className="sales-schedule-branch-button"
                        onClick={() =>
                          toggleBranch(
                            "Unassigned"
                          )
                        }
                        aria-expanded={
                          !collapsedBranches[
                            "Unassigned"
                          ]
                        }
                      >
                        <span className="sales-schedule-branch-icon">
                          {collapsedBranches[
                            "Unassigned"
                          ] ? (
                            <ChevronRight
                              size={16}
                              strokeWidth={2.5}
                            />
                          ) : (
                            <ChevronDown
                              size={16}
                              strokeWidth={2.5}
                            />
                          )}
                        </span>

                        <span className="sales-schedule-branch-name">
                          Unassigned
                        </span>

                        <span className="sales-schedule-branch-count">
                          {unassigned.length}{" "}
                          {unassigned.length ===
                          1
                            ? "appointment"
                            : "appointments"}
                        </span>
                      </button>
                    </div>

                    {!collapsedBranches[
                      "Unassigned"
                    ] && (
                      <div className="sales-schedule-row">

                        <div className="sales-schedule-rep">
                          <div className="sales-schedule-rep-name">
                            Unassigned
                          </div>
                        </div>

                        <div className="sales-schedule-timeline">
                          <TimelineGrid />

                          <div className="sales-schedule-appointments">
                            {unassigned.map(
                              (appointment) => (
                                <AppointmentCard
                                  key={appointmentId(
                                    appointment
                                  )}
                                  appointment={
                                    appointment
                                  }
                                  onSelect={
                                    onSelectAppointment
                                  }
                                />
                              )
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </section>
  )
}
